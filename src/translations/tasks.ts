import type { CollectionAfterChangeHook, TaskConfig } from 'payload'
import { isDeepStrictEqual } from 'node:util'
import { englishTranslationQueueEnabled, assertEnglishTranslationDatabase } from './config'
export { englishTranslationQueueEnabled } from './config'
import { readPath, translationPaths } from '../../scripts/localization/translationCore'
import { prepareProductTranslation, runProductTranslation } from './engine'
import { mongoTranslationStore } from './mongoStore.mjs'
import { openAITranslationProvider } from './provider'

export const queueEnglishProductTranslation: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (!englishTranslationQueueEnabled() || context.skipEnglishTranslation || req.locale === 'en')
    return doc
  if (
    operation !== 'create' &&
    translationPaths.every((path) =>
      isDeepStrictEqual(readPath(doc, path), readPath(previousDoc, path)),
    )
  )
    return doc
  await req.payload.jobs.queue({
    task: 'translateEnglishProduct',
    queue: 'english-products',
    input: { productId: String(doc.id) },
    req,
  })
  return doc
}
export const englishProductTranslationTask: TaskConfig<{
  input: { productId: string }
  output: { status: string }
}> = {
  slug: 'translateEnglishProduct',
  label: 'Английски превод на продукт',
  inputSchema: [{ name: 'productId', type: 'text', required: true }],
  outputSchema: [{ name: 'status', type: 'text', required: true }],
  concurrency: { key: ({ input }) => `english-product-${input.productId}`, exclusive: true },
  retries: { attempts: 2, backoff: { delay: 60000, type: 'exponential' } },
  handler: async ({ input, req }) => {
    if (!englishTranslationQueueEnabled()) return { output: { status: 'disabled' } }
    const connection = req.payload.db.connection
    const db = connection.db
    if (!db) throw Error('Missing translation database')
    assertEnglishTranslationDatabase(db.databaseName)
    const store = mongoTranslationStore(db, connection.getClient(), (id: string) =>
      req.payload.db.collections.products.schema.path('_id').cast(id),
    )
    const prepared = await prepareProductTranslation(store, input.productId)
    const status = prepared.jobId
      ? await runProductTranslation(
          store,
          prepared.jobId,
          process.env.IBIS_EN_TRANSLATION_API_ENABLED === 'true' && process.env.OPENAI_API_KEY
            ? openAITranslationProvider
            : undefined,
        )
      : prepared.status
    if (['manual_review', 'untracked_english', 'needs_review', 'request_unknown'].includes(status))
      req.payload.logger.warn({ msg: 'English product translation requires review', productId: input.productId, status })
    return { output: { status } }
  },
}

// A request that may already have been billed is never sent again. Recovery only
// releases old Payload leases; the durable engine then resumes or holds that request.
export const englishTranslationRecoveryTask: TaskConfig<{
  input: Record<string, never>
  output: { recovered: number }
}> = {
  slug: 'recoverEnglishProductTranslations',
  label: 'Възстановяване на прекъснати английски преводи',
  inputSchema: [],
  outputSchema: [{ name: 'recovered', type: 'number', required: true }],
  concurrency: { key: () => 'english-translation-recovery', exclusive: true },
  schedule: [{ cron: '*/5 * * * *', queue: 'english-products-recovery' }],
  handler: async ({ req }) => {
    if (!englishTranslationQueueEnabled()) return { output: { recovered: 0 } }
    const db = req.payload.db.connection.db
    if (!db) throw Error('Missing translation database')
    assertEnglishTranslationDatabase(db.databaseName)
    const result = await db.collection('payload-jobs').updateMany({
      queue: 'english-products', taskSlug: 'translateEnglishProduct', processing: true,
      hasError: { $ne: true }, completedAt: null,
      updatedAt: { $type: 'date', $lt: new Date(Date.now() - 15 * 60_000) },
    }, { $set: { processing: false, updatedAt: new Date() } })
    return { output: { recovered: result.modifiedCount } }
  },
}
