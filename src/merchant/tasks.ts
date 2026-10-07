import { createHash } from 'node:crypto'
import type { PayloadRequest, TaskConfig } from 'payload'
import { publicProductWhere } from '@/access/publicProductWhere'
import { merchantClient, merchantEnabled, MerchantAPIError } from './client'
import { buildMerchantInput } from './productInput'

export async function queueMerchantProduct(productId: string, req: PayloadRequest) {
  if (!merchantEnabled()) return
  await req.payload.jobs.queue({
    task: 'syncMerchantProduct',
    queue: 'merchant',
    input: { productId },
    req,
  })
}

export async function syncMerchantProduct(
  productId: string,
  req: PayloadRequest,
  client = merchantClient,
) {
  if (!merchantEnabled()) return 'disabled'
  let existing = (
    await req.payload.find({
      collection: 'merchant-sync-entries',
      where: { productId: { equals: productId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
  ).docs[0]
  const save = async (data: Record<string, unknown>) => {
    if (existing)
      existing = await req.payload.update({
        collection: 'merchant-sync-entries',
        id: existing.id,
        data,
        overrideAccess: true,
        req,
      })
    else
      existing = await req.payload.create({
        collection: 'merchant-sync-entries',
        data: { productId, status: 'skipped', ...data },
        overrideAccess: true,
        req,
      })
  }
  try {
    // A list lookup distinguishes deletion from a database/permission failure. Never
    // withdraw listings because a database read failed. Always load the latest state.
    const product = (
      await req.payload.find({
        collection: 'products',
        where: { id: { equals: productId } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
        req,
      })
    ).docs[0]
    const mapped = product ? buildMerchantInput(product) : { reason: 'Продуктът е изтрит.' }
    if (!mapped.input) {
      // Use only this integration's stable offer IDs and its own data source.
      await client.remove(productId)
      await save({
        status: existing?.lastSentAt ? 'removed' : 'skipped',
        reason: mapped.reason,
        error: null,
        inputHash: null,
        googleStatus: null,
        lastCheckedAt: new Date().toISOString(),
      })
      return 'removed'
    }
    const inputHash = createHash('sha256').update(JSON.stringify(mapped.input)).digest('hex')
    const refreshDue =
      !existing?.lastSentAt || Date.now() - Date.parse(existing.lastSentAt) >= 7 * 86400_000
    if (existing?.inputHash !== inputHash || existing.status !== 'sent' || refreshDue) {
      await client.insert(mapped.input)
      // Persist send acknowledgement before fetching asynchronously processed status.
      await save({
        status: 'sent',
        inputHash,
        lastSentAt: new Date().toISOString(),
        error: null,
        reason: null,
      })
    }
    const processed = await client.status(productId)
    // A newly sent product can return 404 while Google is processing it.
    await save({
      googleStatus: processed?.productStatus || null,
      lastCheckedAt: new Date().toISOString(),
    })
    return 'sent'
  } catch (error) {
    const message =
      error instanceof MerchantAPIError
        ? error.message
        : 'Неуспешна Merchant синхронизация. Проверете server logs и конфигурацията.'
    await save({ status: 'failed', error: message })
    throw error
  }
}

export const merchantProductTask: TaskConfig<{
  input: { productId: string }
  output: { status: string }
}> = {
  slug: 'syncMerchantProduct',
  label: 'Синхронизиране на продукт с Google Merchant',
  inputSchema: [{ name: 'productId', type: 'text', required: true }],
  outputSchema: [{ name: 'status', type: 'text', required: true }],
  concurrency: { key: ({ input }) => `merchant-product-${input.productId}`, exclusive: true },
  retries: { attempts: 4, backoff: { delay: 60_000, type: 'exponential' } },
  handler: async ({ input, req }) => ({
    output: { status: await syncMerchantProduct(input.productId, req) },
  }),
}

export const merchantReconcileTask: TaskConfig<{
  input: { cursor?: string; phase?: 'products' | 'entries' }
  output: { queued: number }
}> = {
  slug: 'reconcileMerchantProducts',
  label: 'Проверка и обновяване на Merchant каталога',
  inputSchema: [
    { name: 'cursor', type: 'text' },
    { name: 'phase', type: 'select', options: ['products', 'entries'] },
  ],
  outputSchema: [{ name: 'queued', type: 'number', required: true }],
  retries: { attempts: 3, backoff: { delay: 60_000, type: 'exponential' } },
  schedule: [
    {
      cron: '0 3 * * *',
      queue: 'merchant',
      hooks: {
        beforeSchedule: async (args) =>
          merchantEnabled() ? args.defaultBeforeSchedule(args) : { shouldSchedule: false },
      },
    },
  ],
  handler: async ({ input, req }) => {
    if (!merchantEnabled()) return { output: { queued: 0 } }
    const phase = input.phase || 'products'
    const collection = phase === 'products' ? 'products' : 'merchant-sync-entries'
    const result = await req.payload.find({
      collection,
      limit: 100,
      sort: 'id',
      depth: 0,
      where: {
        and: [
          ...(phase === 'products' ? [publicProductWhere] : []),
          ...(input.cursor ? [{ id: { greater_than: input.cursor } }] : []),
        ],
      },
      overrideAccess: true,
      req,
    })
    for (const doc of result.docs)
      await queueMerchantProduct('productId' in doc ? doc.productId : doc.id, req)
    if (result.hasNextPage || phase === 'products') {
      await req.payload.jobs.queue({
        task: 'reconcileMerchantProducts',
        queue: 'merchant',
        req,
        input: result.hasNextPage
          ? { phase, cursor: result.docs.at(-1)!.id }
          : { phase: 'entries' },
      })
    }
    return { output: { queued: result.docs.length } }
  },
}
