import { describe, expect, it, vi } from 'vitest'

import {
  buildCatalogSyncContentFingerprint,
  loadCatalogSyncBatchCandidates,
  runCatalogSyncBatch,
  type CatalogSyncProductState,
  type CatalogSyncSourceProduct,
} from '@/services/catalogSync'

type TestProduct = CatalogSyncSourceProduct & {
  catalogSync: CatalogSyncProductState
  id: string
  published: boolean
}

const resolvedCategory = { ancestors: [], id: 'category-1', title: 'Категория' }

const product = (id: string, patch: Partial<TestProduct> = {}): TestProduct => ({
  brand: { id: 'brand-1', title: 'Марка' },
  catalogSync: {},
  categories: ['category-1'],
  description: 'Описание',
  id,
  images: [{ alt: 'Снимка', storageKey: `products/${id}.jpg` }],
  manufacturerCode: 'ORIGINAL',
  originalSku: `OR-${id}`,
  price: 10,
  published: true,
  shortDescription: 'Кратко описание',
  sku: `SKU-${id}`,
  stockQty: 3,
  stockStatus: 'instock',
  title: `Продукт ${id}`,
  updatedAt: '2026-08-31T10:00:00.000Z',
  ...patch,
})

const request = (initialProducts: TestProduct[]) => {
  const products = new Map(initialProducts.map((item) => [item.id, structuredClone(item)]))
  const create = vi.fn()
  const update = vi.fn(async ({ collection, data, id }) => {
    if (collection === 'products') {
      const current = products.get(String(id))!
      const next = { ...current, catalogSync: data.catalogSync }
      products.set(String(id), next)
      return structuredClone(next)
    }
    return { id, ...data }
  })
  const find = vi.fn(async ({ collection, where }) => {
    if (collection !== 'products') return { docs: [], hasNextPage: false }
    const retryOnly = JSON.stringify(where).includes('catalogSync.contentStatus')
    const docs = [...products.values()].filter(
      (item) =>
        item.published === true &&
        (!retryOnly ||
          item.catalogSync.contentStatus === 'error' ||
          item.catalogSync.approvalStatus === 'error'),
    )
    return { docs: structuredClone(docs), hasNextPage: false }
  })
  const findByID = vi.fn(async ({ collection, id }) => {
    if (collection === 'categories') {
      return { id: 'category-1', parent: null, title: resolvedCategory.title }
    }
    const item = products.get(String(id))
    if (!item) throw new Error('Product not found')
    return structuredClone(item)
  })
  const payload = {
    create,
    find,
    findByID,
    logger: { error: vi.fn(), warn: vi.fn() },
    update,
  }
  return { create, find, payload, products, req: { payload } as any, update }
}

const persistence = () => {
  let current: any = null
  const clone = (value: any) => structuredClone(value)
  return {
    createRun: vi.fn(async (run) => {
      current = { ...clone(run), id: 'run-1' }
      return clone(current)
    }),
    findRunningRun: vi.fn(async () => (current?.status === 'running' ? clone(current) : null)),
    get current() {
      return current
    },
    set current(value: any) {
      current = clone(value)
    },
    updateRun: vi.fn(async (run) => {
      current = clone(run)
      return clone(current)
    }),
  }
}

const enabled = { CATALOG_SYNC_API_KEY: 'test-only', CATALOG_SYNC_SEND_ENABLED: 'true' }

describe('controlled Catalog Sync batch', () => {
  it('selects only published products and retry-failed selects only failed published products', async () => {
    const failed = product('failed', { catalogSync: { contentStatus: 'error' } })
    const unpublished = product('unpublished', { published: false })
    const { req } = request([product('published'), failed, unpublished])

    await expect(loadCatalogSyncBatchCandidates({ mode: 'dry-run', req })).resolves.toEqual([
      { productId: 'published', sku: 'SKU-published' },
      { productId: 'failed', sku: 'SKU-failed' },
    ])
    await expect(loadCatalogSyncBatchCandidates({ mode: 'retry-failed', req })).resolves.toEqual([
      { productId: 'failed', sku: 'SKU-failed' },
    ])
  })

  it('accepts a published zero-stock product in dry-run without writes or network', async () => {
    const { create, req, update } = request([
      product('zero', { stockQty: 0, stockStatus: 'outofstock' }),
      product('hidden', { published: false }),
    ])
    const send = vi.fn()
    const results: any[] = []

    const report = await runCatalogSyncBatch({
      mode: 'dry-run',
      onResult: (result) => results.push(result),
      req,
      transport: { getStatus: vi.fn(), send },
    })

    expect(report.counts).toMatchObject({ eligible: 1, invalid: 0, needsSend: 1, valid: 1 })
    expect(results).toEqual([{ outcome: 'needs-send', productId: 'zero', sku: 'SKU-zero' }])
    expect(send).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('skips an already-current product without consuming the send limit', async () => {
    const source = product('current')
    const fingerprint = buildCatalogSyncContentFingerprint({
      ...source,
      categories: [resolvedCategory],
    })
    source.catalogSync = {
      approved: true,
      approvalStatus: 'approved',
      contentStatus: 'current',
      lastContentFingerprint: fingerprint,
    }
    const { req } = request([source])
    const store = persistence()
    const send = vi.fn()

    const report = await runCatalogSyncBatch({
      env: enabled,
      mode: 'send',
      persistence: store,
      req,
      transport: { getStatus: vi.fn(), send },
    })

    expect(report.counts).toMatchObject({ alreadyCurrent: 1, sent: 0 })
    expect(send).not.toHaveBeenCalled()
  })

  it('sends one product and polls it until success', async () => {
    const { req } = request([product('one')])
    const store = persistence()
    const send = vi.fn(async (event) => ({ eventId: event.eventId, status: 'queued' }))
    const getStatus = vi.fn(async (eventId) => ({ eventId, status: 'succeeded' }))

    const report = await runCatalogSyncBatch({
      env: enabled,
      mode: 'send',
      persistence: store,
      req,
      sleep: vi.fn(),
      transport: { getStatus, send },
    })

    expect(report.counts).toMatchObject({ sent: 1, succeeded: 1 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(getStatus).toHaveBeenCalledTimes(1)
  })

  it('records a failed product and continues with the next product', async () => {
    const { req } = request([product('bad'), product('good')])
    const store = persistence()
    const send = vi.fn(async (event) => ({ eventId: event.eventId, status: 'queued' }))
    const getStatus = vi.fn(async (eventId) => ({
      error:
        eventId === store.current.activeEventId && store.current.activeProductId === 'bad'
          ? 'bad'
          : undefined,
      eventId,
      status: store.current.activeProductId === 'bad' ? 'failed' : 'succeeded',
    }))

    const report = await runCatalogSyncBatch({
      env: enabled,
      mode: 'send',
      persistence: store,
      req,
      sleep: vi.fn(),
      transport: { getStatus, send },
    })

    expect(report.counts).toMatchObject({ failed: 1, sent: 2, succeeded: 1 })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('resumes an existing checkpoint from its next product', async () => {
    const { req } = request([product('first'), product('second')])
    const store = persistence()
    store.current = {
      activeCounted: false,
      activeEventId: null,
      activeProductId: null,
      completedAt: null,
      completionReason: null,
      failedCount: 0,
      id: 'interrupted-run',
      invalidCount: 0,
      limit: 20,
      mode: 'send',
      nextIndex: 1,
      pollIntervalMs: 2000,
      results: [{ outcome: 'succeeded', productId: 'first', sku: 'SKU-first' }],
      sentCount: 1,
      skippedCurrentCount: 0,
      snapshot: [
        { productId: 'first', sku: 'SKU-first' },
        { productId: 'second', sku: 'SKU-second' },
      ],
      startedAt: '2026-08-31T10:00:00.000Z',
      status: 'running',
      succeededCount: 1,
      timeoutMs: 600000,
    }
    const send = vi.fn(async (event) => ({ eventId: event.eventId, status: 'succeeded' }))

    const report = await runCatalogSyncBatch({
      env: enabled,
      mode: 'send',
      persistence: store,
      req,
      transport: { getStatus: vi.fn(), send },
    })

    expect(report.resumedRun).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].product.sourceProductId).toBe('second')
  })

  it('resumes a pending active event by polling without a duplicate POST', async () => {
    const pending = product('pending', {
      catalogSync: {
        approvalStatus: 'pending',
        contentStatus: 'pending',
        lastEventId: 'event-pending',
        lastRemoteStatus: 'queued',
        pendingContentFingerprint: 'pending-fingerprint',
      },
    })
    const { req } = request([pending])
    const store = persistence()
    store.current = {
      activeCounted: false,
      activeEventId: 'event-pending',
      activeProductId: 'pending',
      completedAt: null,
      completionReason: null,
      failedCount: 0,
      id: 'interrupted-active-run',
      invalidCount: 0,
      limit: 1,
      mode: 'send',
      nextIndex: 0,
      pollIntervalMs: 2000,
      results: [],
      sentCount: 0,
      skippedCurrentCount: 0,
      snapshot: [{ productId: 'pending', sku: 'SKU-pending' }],
      startedAt: '2026-08-31T10:00:00.000Z',
      status: 'running',
      succeededCount: 0,
      timeoutMs: 600000,
    }
    const send = vi.fn()
    const getStatus = vi.fn(async () => ({ eventId: 'event-pending', status: 'succeeded' }))

    const report = await runCatalogSyncBatch({
      env: enabled,
      mode: 'send',
      persistence: store,
      req,
      sleep: vi.fn(),
      transport: { getStatus, send },
    })

    expect(report.counts).toMatchObject({ sent: 1, succeeded: 1 })
    expect(getStatus).toHaveBeenCalledWith('event-pending')
    expect(send).not.toHaveBeenCalled()
  })

  it('retry-failed sends only failed products', async () => {
    const failed = product('failed', { catalogSync: { contentStatus: 'error' } })
    const { req } = request([failed, product('untouched')])
    const store = persistence()
    const send = vi.fn(async (event) => ({ eventId: event.eventId, status: 'succeeded' }))

    await runCatalogSyncBatch({
      env: enabled,
      mode: 'retry-failed',
      persistence: store,
      req,
      transport: { getStatus: vi.fn(), send },
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].product.sourceProductId).toBe('failed')
  })

  it('does not send a duplicate when the completed batch is run again', async () => {
    const { req } = request([product('once')])
    const send = vi.fn(async (event) => ({ eventId: event.eventId, status: 'succeeded' }))

    await runCatalogSyncBatch({
      env: enabled,
      mode: 'send',
      persistence: persistence(),
      req,
      transport: { getStatus: vi.fn(), send },
    })
    await runCatalogSyncBatch({
      env: enabled,
      mode: 'send',
      persistence: persistence(),
      req,
      transport: { getStatus: vi.fn(), send },
    })

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('limits real sends to 20, then sends only the remaining 5 on the next run', async () => {
    const products = Array.from({ length: 25 }, (_, index) =>
      product(`product-${String(index + 1).padStart(2, '0')}`),
    )
    const { req } = request(products)
    const store = persistence()
    const send = vi.fn(async (event) => ({ eventId: event.eventId, status: 'succeeded' }))
    const transport = { getStatus: vi.fn(), send }

    const firstReport = await runCatalogSyncBatch({
      env: enabled,
      limit: 20,
      mode: 'send',
      persistence: store,
      req,
      transport,
    })
    const firstRunProductIds = send.mock.calls.map(
      ([event]) => event.product.sourceProductId as string,
    )

    expect(firstReport.counts).toMatchObject({ eligible: 25, sent: 20, succeeded: 20 })
    expect(store.current.completionReason).toBe('limit_reached')
    expect(firstRunProductIds).toEqual(products.slice(0, 20).map(({ id }) => id))

    const secondReport = await runCatalogSyncBatch({
      env: enabled,
      limit: 20,
      mode: 'send',
      persistence: store,
      req,
      transport,
    })
    const allSentProductIds = send.mock.calls.map(
      ([event]) => event.product.sourceProductId as string,
    )

    expect(secondReport.counts).toMatchObject({
      alreadyCurrent: 20,
      eligible: 25,
      sent: 5,
      succeeded: 5,
    })
    expect(store.current.completionReason).toBe('exhausted')
    expect(allSentProductIds.slice(20)).toEqual(products.slice(20).map(({ id }) => id))
    expect(new Set(allSentProductIds).size).toBe(25)
    expect(send).toHaveBeenCalledTimes(25)
  })
})
