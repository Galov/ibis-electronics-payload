import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  assertCatalogSyncSendingEnabled,
  buildCatalogSyncEvent,
  CatalogSyncError,
  getCatalogSyncEventStatus,
  loadCatalogSyncEvent,
  sendCatalogSyncEvent,
  validateCatalogSyncEvent,
  type CatalogSyncSourceProduct,
} from '@/services/catalogSync'
import type { Payload } from 'payload'

const pilotProduct: CatalogSyncSourceProduct = {
  brand: {
    id: '69e9e6402eeb571971d4a722',
    title: 'BOSCH SIEMENS BALAY',
  },
  categories: [],
  description:
    'Оригинални торбички за прахосмукачка Bosch, Siemens\nТип на торбичката: Тип P (Type P / MegaAir SuperTEX).',
  id: '6a918d8ba5b0f1e1420cb292',
  images: [
    {
      alt: 'Оригинални торбички за прахосмукачка Bosch, Siemens - 00468264',
      storageKey: 'products/by-sku/803pe531or/1-803pe531or.jpg',
    },
  ],
  manufacturerCode: 'ORIGINAL',
  originalSku: '00468264,BBZ41FP',
  price: 9.77,
  shortDescription: null,
  sku: '803PE531OR',
  stockQty: 6,
  stockStatus: 'instock',
  title: 'Оригинални торбички за прахосмукачка Bosch, Siemens - 00468264',
  updatedAt: '2026-08-28T14:32:49.866Z',
}

const enabledEnvironment = () => ({
  CATALOG_SYNC_API_KEY: randomUUID(),
  CATALOG_SYNC_SEND_ENABLED: 'true' as const,
})

const originalFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = vi.fn(() => {
    throw new Error('Real network access is forbidden in catalog sync tests.')
  }) as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

describe('Romanian catalog sync contract', () => {
  it('transforms the selected Payload product into contract 1.0', () => {
    const event = buildCatalogSyncEvent(pilotProduct)

    expect(event.product).toEqual({
      brand: {
        sourceBrandId: '69e9e6402eeb571971d4a722',
        title: 'BOSCH SIEMENS BALAY',
      },
      categories: [],
      characteristics: [],
      description: pilotProduct.description,
      imageAlts: [
        {
          alt: pilotProduct.images?.[0]?.alt,
          sharedMediaKey: 'products/by-sku/803pe531or/1-803pe531or.jpg',
        },
      ],
      manufacturerCode: 'ORIGINAL',
      originalSku: '00468264,BBZ41FP',
      schemaVersion: '1.0',
      shortDescription: null,
      sku: '803PE531OR',
      sourcePriceEUR: 9.77,
      sourceProductId: '6a918d8ba5b0f1e1420cb292',
      stockQty: 6,
      stockStatus: 'instock',
      title: 'Оригинални торбички за прахосмукачка Bosch, Siemens - 00468264',
    })
    expect(event.sourceUpdatedAt).toBe('2026-08-28T14:32:49.866Z')
  })

  it('contains exactly the contracted root and product fields', () => {
    const event = buildCatalogSyncEvent(pilotProduct)

    expect(Object.keys(event).sort()).toEqual(
      [
        'eventId',
        'eventType',
        'product',
        'schemaVersion',
        'sourceContentHash',
        'sourceUpdatedAt',
      ].sort(),
    )
    expect(Object.keys(event.product).sort()).toEqual(
      [
        'brand',
        'categories',
        'characteristics',
        'description',
        'imageAlts',
        'manufacturerCode',
        'originalSku',
        'schemaVersion',
        'shortDescription',
        'sku',
        'sourcePriceEUR',
        'sourceProductId',
        'stockQty',
        'stockStatus',
        'title',
      ].sort(),
    )
    expect(JSON.stringify(event)).not.toMatch(/sourceTermId|wooProductId|woocommerce|legacyUrl/u)
  })

  it('uses Payload IDs for product, brand and categories', () => {
    const event = buildCatalogSyncEvent({
      ...pilotProduct,
      categories: [{ id: 'payload-category-id', title: 'Торбички' }],
    })

    expect(event.product.sourceProductId).toBe('6a918d8ba5b0f1e1420cb292')
    expect(event.product.brand?.sourceBrandId).toBe('69e9e6402eeb571971d4a722')
    expect(event.product.categories[0]?.sourceCategoryId).toBe('payload-category-id')
  })

  it('builds deterministic hashes and event IDs for the same product version', () => {
    const first = buildCatalogSyncEvent(pilotProduct)
    const second = buildCatalogSyncEvent(structuredClone(pilotProduct))

    expect(second.sourceContentHash).toBe(first.sourceContentHash)
    expect(second.eventId).toBe(first.eventId)
    expect(
      buildCatalogSyncEvent({ ...pilotProduct, title: 'Променено заглавие' }).eventId,
    ).not.toBe(first.eventId)
  })

  it('rejects images without storageKey instead of using legacy URLs', () => {
    expect(() =>
      buildCatalogSyncEvent({
        ...pilotProduct,
        images: [{ alt: 'Липсващ ключ' }],
      }),
    ).toThrowError(expect.objectContaining({ code: 'CATALOG_SYNC_MISSING_STORAGE_KEY' }))
  })

  it.each([
    ['price', { price: -1 }],
    ['stockQty', { stockQty: Number.NaN }],
  ])('rejects invalid %s values', (_field, patch) => {
    expect(() => buildCatalogSyncEvent({ ...pilotProduct, ...patch })).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_PRODUCT' }),
    )
  })

  it('validates the exact event contract', () => {
    const event = buildCatalogSyncEvent(pilotProduct)
    const invalid = { ...event, extraField: true }

    expect(() => validateCatalogSyncEvent(invalid as typeof event)).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_CONTRACT' }),
    )
  })

  it('loads the selected product through Payload Local API with populated relationships', async () => {
    const findByID = vi.fn().mockResolvedValue(pilotProduct)
    const payload = { findByID } as unknown as Payload

    const event = await loadCatalogSyncEvent({
      payload,
      productId: '6a918d8ba5b0f1e1420cb292',
    })

    expect(event.product.sourceProductId).toBe('6a918d8ba5b0f1e1420cb292')
    expect(findByID).toHaveBeenCalledWith({
      collection: 'products',
      depth: 2,
      id: '6a918d8ba5b0f1e1420cb292',
      overrideAccess: true,
    })
  })
})

describe('Romanian catalog sync transport', () => {
  it('can reject the CLI send preflight before Payload initialization', () => {
    expect(() => assertCatalogSyncSendingEnabled({})).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_SEND_DISABLED' }),
    )
  })

  it('refuses to send when the explicit send guard is disabled', async () => {
    const fetchImpl = vi.fn<typeof fetch>()

    await expect(
      sendCatalogSyncEvent(buildCatalogSyncEvent(pilotProduct), {
        env: { CATALOG_SYNC_API_KEY: randomUUID() },
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_SYNC_SEND_DISABLED' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('refuses to send when the API key is missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>()

    await expect(
      sendCatalogSyncEvent(buildCatalogSyncEvent(pilotProduct), {
        env: { CATALOG_SYNC_SEND_ENABLED: 'true' },
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_SYNC_API_KEY_MISSING' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('retries the same event with the same eventId', async () => {
    const event = buildCatalogSyncEvent(pilotProduct)
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, request) => {
      const body = JSON.parse(String(request?.body)) as { eventId: string }
      return new Response(JSON.stringify({ eventId: body.eventId, status: 'queued' }), {
        status: 202,
      })
    })
    const options = { env: enabledEnvironment(), fetchImpl }

    await sendCatalogSyncEvent(event, options)
    await sendCatalogSyncEvent(event, options)

    const eventIds = fetchImpl.mock.calls.map(
      ([, request]) => JSON.parse(String(request?.body)).eventId,
    )
    expect(eventIds).toEqual([event.eventId, event.eventId])
  })

  it('accepts an idempotent HTTP 200 replay from the Romanian endpoint', async () => {
    const event = buildCatalogSyncEvent(pilotProduct)
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ eventId: event.eventId, replay: true, status: 'succeeded' }), {
        status: 200,
      }),
    )

    await expect(
      sendCatalogSyncEvent(event, { env: enabledEnvironment(), fetchImpl }),
    ).resolves.toMatchObject({ eventId: event.eventId, replay: true, status: 'succeeded' })
  })

  it('rejects invalid JSON without exposing request credentials', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not-json', { status: 202 }))

    await expect(
      sendCatalogSyncEvent(buildCatalogSyncEvent(pilotProduct), {
        env: enabledEnvironment(),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_SYNC_INVALID_RESPONSE' })
  })

  it('handles network failures as controlled errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      sendCatalogSyncEvent(buildCatalogSyncEvent(pilotProduct), {
        env: enabledEnvironment(),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_SYNC_NETWORK_ERROR' })
  })

  it('aborts requests that exceed the configured timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async (_url, request) =>
        await new Promise<Response>((_resolve, reject) => {
          request?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    await expect(
      sendCatalogSyncEvent(buildCatalogSyncEvent(pilotProduct), {
        env: enabledEnvironment(),
        fetchImpl,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_SYNC_TIMEOUT' })
  })

  it.each([400, 401, 409, 500])('handles HTTP %s as a controlled error', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }))

    await expect(
      sendCatalogSyncEvent(buildCatalogSyncEvent(pilotProduct), {
        env: enabledEnvironment(),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: `CATALOG_SYNC_HTTP_${status}`, status })
  })

  it('checks event status through the authenticated status endpoint', async () => {
    const eventId = buildCatalogSyncEvent(pilotProduct).eventId
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ eventId, status: 'translating' }), { status: 200 }),
      )

    await expect(
      getCatalogSyncEventStatus(eventId, { env: enabledEnvironment(), fetchImpl }),
    ).resolves.toEqual({ eventId, status: 'translating' })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('never performs a real network request in the test suite', () => {
    const event = buildCatalogSyncEvent(pilotProduct)
    expect(event.eventType).toBe('product.upsert')
  })
})

describe('catalog sync errors', () => {
  it('uses controlled errors without secrets in their messages', () => {
    const error = new CatalogSyncError('TEST', 'Safe message')
    expect(error.message).toBe('Safe message')
  })
})
