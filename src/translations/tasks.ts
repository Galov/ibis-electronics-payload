import type { CollectionAfterChangeHook, TaskConfig } from 'payload'
import { isDeepStrictEqual } from 'node:util'
import {
  localProductLocalizationEnabled,
  localEnglishDatabaseNames,
} from '@/i18n/localProductLocalization'
import { readPath, translationPaths } from '../../scripts/localization/translationCore'
import { prepareProductTranslation, runProductTranslation } from './engine'
import { mongoTranslationStore } from './mongoStore.mjs'
import { openAITranslationProvider } from './provider'

// Release gate: this implementation cannot be activated on the production DB.
export const englishTranslationQueueEnabled = () =>
  process.env.IBIS_EN_TRANSLATION_QUEUE_ENABLED === 'true' && localProductLocalizationEnabled()
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
    if (!db || !localEnglishDatabaseNames.some((name) => db.databaseName === name))
      throw Error('Expected isolated translation DB')
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
    return { output: { status } }
  },
}
