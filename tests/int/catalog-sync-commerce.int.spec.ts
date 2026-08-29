import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { CatalogSyncOutbox } from '@/payload-types'
import {
  assertCatalogSyncCommerceSendingEnabled,
  buildCatalogSyncCommerceEvent,
  buildCatalogSyncCommerceFingerprint,
  buildCatalogSyncFingerprints,
  buildCatalogSyncOutboxWhere,
  enqueueCatalogCommerceSync,
  getEnabledCatalogSyncWorkerActions,
  parseCatalogSyncCommerceEvent,
  processCatalogSyncOutboxItem,
  sendCatalogSyncCommerceEvent,
  type CatalogSyncProductState,
  type CatalogSyncSourceProduct,
} from '@/services/catalogSync'

type TestProduct = CatalogSyncSourceProduct & {
  catalogSync: CatalogSyncProductState
  id: string
}

const product = (patch: Partial<TestProduct> = {}): TestProduct => ({
  brand: { id: 'brand-1', title: 'Марка' },
  catalogSync: { approved: true },
  categories: [{ id: 'category-1', title: 'Категория' }],
  description: 'Описание',
  id: 'product-1',
  images: [{ alt: 'Снимка', storageKey: 'products/product-1.jpg' }],
  price: 12.5,
  sku: 'SKU-1',
  stockQty: 4,
  stockStatus: 'instock',
  title: 'Продукт',
  updatedAt: '2026-08-29T12:00:00.000Z',
  ...patch,
})

const commerceOutbox = (
  source: TestProduct,
  patch: Partial<CatalogSyncOutbox> = {},
): CatalogSyncOutbox => {
  const event = buildCatalogSyncCommerceEvent(source)
  const fingerprints = buildCatalogSyncFingerprints(source)
  return {
    action: 'commerce',
    attempts: 0,
    commerceFingerprint: fingerprints.commerce,
    contentFingerprint: fingerprints.content,
    createdAt: source.updatedAt || '2026-08-29T12:00:00.000Z',
    dedupeKey: `commerce:${event.eventId}`,
    eventId: event.eventId,
    eventPayload: event,
    id: 'commerce-outbox-1',
    product: source.id,
    status: 'pending',
    updatedAt: source.updatedAt || '2026-08-29T12:00:00.000Z',
    ...patch,
  }
}

const workerReq = (source: TestProduct) => {
  const updates: Array<Record<string, any>> = []
  const req = {
    payload: {
      findByID: vi.fn().mockResolvedValue(source),
      update: vi.fn(async (args) => {
        updates.push(args)
        return args.data
      }),
    },
  } as any
  return { req, updates }
}

const originalFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = vi.fn(() => {
    throw new Error('Real network access is forbidden in commerce sync tests.')
  }) as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

describe('Catalog Sync 1.1 commerce contract', () => {
  it('builds the exact strict 1.1 envelope without content fields', () => {
    const event = buildCatalogSyncCommerceEvent(product())

    expect(Object.keys(event).sort()).toEqual(
      [
        'eventId',
        'eventType',
        'product',
        'schemaVersion',
        'sourceCommerceHash',
        'sourceUpdatedAt',
      ].sort(),
    )
    expect(event).toMatchObject({
      eventType: 'product.commerce_updated',
      product: {
        sourcePriceEUR: 12.5,
        sourceProductId: 'product-1',
        stockQty: 4,
        stockStatus: 'instock',
      },
      schemaVersion: '1.1',
    })
    expect(Object.keys(event.product).sort()).toEqual(
      ['sourcePriceEUR', 'sourceProductId', 'stockQty', 'stockStatus'].sort(),
    )
    expect(JSON.stringify(event)).not.toMatch(/title|description|image|seo|brand|categor/u)
  })

  it('builds deterministic commerce hashes and versioned event IDs', () => {
    const source = product()
    const first = buildCatalogSyncCommerceEvent(source)
    const second = buildCatalogSyncCommerceEvent(structuredClone(source))
    const contentOnly = product({ description: 'Ново описание' })

    expect(second.sourceCommerceHash).toBe(first.sourceCommerceHash)
    expect(second.eventId).toBe(first.eventId)
    expect(buildCatalogSyncCommerceFingerprint(contentOnly)).toBe(first.sourceCommerceHash)
    expect(buildCatalogSyncCommerceEvent(contentOnly).eventId).toBe(first.eventId)
    expect(buildCatalogSyncCommerceEvent(product({ price: 13 })).eventId).not.toBe(first.eventId)
    expect(
      buildCatalogSyncCommerceEvent(product({ updatedAt: '2026-08-29T12:01:00.000Z' })).eventId,
    ).not.toBe(first.eventId)
  })

  it('strictly rejects extra fields and invalid commerce values', () => {
    const event = buildCatalogSyncCommerceEvent(product())
    expect(() => parseCatalogSyncCommerceEvent({ ...event, title: 'forbidden' })).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT' }),
    )
    expect(() =>
      parseCatalogSyncCommerceEvent({
        ...event,
        product: { ...event.product, title: 'forbidden' },
      }),
    ).toThrowError(expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT' }))
    expect(() => buildCatalogSyncCommerceEvent(product({ price: -1 }))).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_COMMERCE' }),
    )
    expect(() => buildCatalogSyncCommerceEvent(product({ stockQty: Number.NaN }))).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_COMMERCE' }),
    )
  })
})

describe('Catalog Sync 1.1 commerce transport and guard', () => {
  it('keeps content and commerce worker actions independently guarded', () => {
    expect(getEnabledCatalogSyncWorkerActions({})).toEqual([])
    expect(getEnabledCatalogSyncWorkerActions({ CATALOG_SYNC_SEND_ENABLED: 'true' })).toEqual([
      'initial',
      'content',
    ])
    expect(
      getEnabledCatalogSyncWorkerActions({ CATALOG_SYNC_COMMERCE_SEND_ENABLED: 'true' }),
    ).toEqual(['commerce'])
    expect(() => assertCatalogSyncCommerceSendingEnabled({})).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_COMMERCE_SEND_DISABLED' }),
    )
  })

  it('does not make a request when the commerce guard is disabled by default', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(
      sendCatalogSyncCommerceEvent(buildCatalogSyncCommerceEvent(product()), {
        env: { CATALOG_SYNC_API_KEY: randomUUID(), CATALOG_SYNC_SEND_ENABLED: 'true' },
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_SYNC_COMMERCE_SEND_DISABLED' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('accepts queued and idempotent replay responses with the same event ID', async () => {
    const event = buildCatalogSyncCommerceEvent(product())
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ eventId: event.eventId, status: 'queued' }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ eventId: event.eventId, replay: true, status: 'succeeded' }),
          { status: 200 },
        ),
      )
    const options = {
      env: {
        CATALOG_SYNC_API_KEY: randomUUID(),
        CATALOG_SYNC_COMMERCE_SEND_ENABLED: 'true' as const,
      },
      fetchImpl,
    }

    await expect(sendCatalogSyncCommerceEvent(event, options)).resolves.toMatchObject({
      status: 'queued',
    })
    await expect(sendCatalogSyncCommerceEvent(event, options)).resolves.toMatchObject({
      replay: true,
      status: 'succeeded',
    })
    const sentIds = fetchImpl.mock.calls.map(
      ([, request]) => JSON.parse(String(request?.body)).eventId,
    )
    expect(sentIds).toEqual([event.eventId, event.eventId])
  })
})

describe('Catalog Sync 1.1 commerce worker', () => {
  it('reuses an active commerce outbox item with the same fingerprint', async () => {
    const source = product()
    const active = commerceOutbox(source)
    const req = {
      payload: {
        create: vi.fn(),
        find: vi.fn().mockResolvedValue({ docs: [active] }),
        update: vi.fn(),
      },
    } as any

    await enqueueCatalogCommerceSync({
      product: product({ updatedAt: '2026-08-29T12:05:00.000Z' }),
      req,
    })

    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it('updates only commerce state after a successful delivery', async () => {
    const source = product()
    const event = buildCatalogSyncCommerceEvent(source)
    const { req, updates } = workerReq(source)

    await processCatalogSyncOutboxItem({
      item: commerceOutbox(source),
      req,
      transport: {
        getStatus: vi.fn(),
        sendCommerce: vi.fn().mockResolvedValue({ eventId: event.eventId, status: 'succeeded' }),
        sendContent: vi.fn(),
      },
    })

    const stateUpdate = updates.find((update) => update.collection === 'products')
    expect(stateUpdate?.data.catalogSync).toMatchObject({
      commerceLastError: null,
      commerceStatus: 'current',
      lastCommerceFingerprint: event.sourceCommerceHash,
      lastSuccessfulEventId: event.eventId,
    })
    expect(stateUpdate?.data.catalogSync).not.toHaveProperty('contentStatus')
    expect(stateUpdate?.data.catalogSync).not.toHaveProperty('lastContentFingerprint')
  })

  it('polls an accepted event and treats superseded as terminal without resending', async () => {
    const source = product()
    const fingerprint = buildCatalogSyncCommerceFingerprint(source)
    const current = product({
      catalogSync: { approved: true, lastCommerceFingerprint: fingerprint },
    })
    const item = commerceOutbox(current, { status: 'accepted' })
    const { req, updates } = workerReq(current)
    const sendCommerce = vi.fn()

    await processCatalogSyncOutboxItem({
      item,
      req,
      transport: {
        getStatus: vi.fn().mockResolvedValue({ eventId: item.eventId, status: 'superseded' }),
        sendCommerce,
        sendContent: vi.fn(),
      },
    })

    expect(sendCommerce).not.toHaveBeenCalled()
    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'catalog-sync-outbox',
        data: expect.objectContaining({ status: 'succeeded' }),
      }),
    )
    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'products',
        data: expect.objectContaining({
          catalogSync: expect.objectContaining({ commerceStatus: 'current' }),
        }),
      }),
    )
  })

  it('keeps a network failure retryable and leaves content state unchanged', async () => {
    const source = product({
      catalogSync: { approved: true, contentStatus: 'changed' },
    })
    const { req, updates } = workerReq(source)

    await processCatalogSyncOutboxItem({
      item: commerceOutbox(source),
      req,
      transport: {
        getStatus: vi.fn(),
        sendCommerce: vi.fn().mockRejectedValue(new Error('fetch failed')),
        sendContent: vi.fn(),
      },
    })

    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'catalog-sync-outbox',
        data: expect.objectContaining({ attempts: 1, status: 'retry_wait' }),
      }),
    )
    const stateUpdate = updates.find((update) => update.collection === 'products')
    expect(stateUpdate?.data.catalogSync).toMatchObject({
      commerceLastError: 'fetch failed',
      commerceStatus: 'error',
    })
    expect(stateUpdate?.data.catalogSync.contentStatus).toBe('changed')
  })

  it('stops retrying after the eighth failed delivery attempt', async () => {
    const source = product()
    const { req, updates } = workerReq(source)

    await processCatalogSyncOutboxItem({
      item: commerceOutbox(source, { attempts: 7, status: 'retry_wait' }),
      req,
      transport: {
        getStatus: vi.fn(),
        sendCommerce: vi.fn().mockRejectedValue(new Error('still failing')),
        sendContent: vi.fn(),
      },
    })

    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'catalog-sync-outbox',
        data: expect.objectContaining({ attempts: 8, nextAttemptAt: null, status: 'failed' }),
      }),
    )
  })

  it('records a remote unknown-product failure without content fallback', async () => {
    const source = product()
    const item = commerceOutbox(source, { status: 'accepted' })
    const { req, updates } = workerReq(source)
    const sendContent = vi.fn()

    await processCatalogSyncOutboxItem({
      item,
      req,
      transport: {
        getStatus: vi.fn().mockResolvedValue({
          error: 'Румънският продукт не съществува.',
          eventId: item.eventId,
          status: 'failed',
        }),
        sendCommerce: vi.fn(),
        sendContent,
      },
    })

    expect(sendContent).not.toHaveBeenCalled()
    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'products',
        data: expect.objectContaining({
          catalogSync: expect.objectContaining({
            commerceLastError: 'Румънският продукт не съществува.',
            commerceStatus: 'error',
          }),
        }),
      }),
    )
  })

  it('never sends a commerce item for an unapproved product', async () => {
    const source = product({ catalogSync: { approved: false } })
    const { req, updates } = workerReq(source)
    const sendCommerce = vi.fn()

    await processCatalogSyncOutboxItem({
      item: commerceOutbox(source),
      req,
      transport: { getStatus: vi.fn(), sendCommerce, sendContent: vi.fn() },
    })

    expect(sendCommerce).not.toHaveBeenCalled()
    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'catalog-sync-outbox',
        data: expect.objectContaining({ status: 'failed' }),
      }),
    )
  })

  it('selects due retries and stale sending leases only for enabled actions', () => {
    const now = '2026-08-29T12:30:00.000Z'
    expect(buildCatalogSyncOutboxWhere(['commerce'], now)).toEqual({
      and: [
        { action: { in: ['commerce'] } },
        {
          or: [
            {
              and: [
                { status: { in: ['pending', 'accepted', 'retry_wait'] } },
                {
                  or: [
                    { nextAttemptAt: { less_than_equal: now } },
                    { nextAttemptAt: { exists: false } },
                  ],
                },
              ],
            },
            {
              and: [
                { status: { equals: 'sending' } },
                { leaseExpiresAt: { less_than_equal: now } },
              ],
            },
          ],
        },
      ],
    })
  })
})
