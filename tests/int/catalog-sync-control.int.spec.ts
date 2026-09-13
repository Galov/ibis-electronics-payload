import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  buildCatalogSyncContentFingerprint,
  buildCatalogSyncEvent,
  getCatalogSyncProductStatus,
  loadCatalogSyncProductForUser,
  refreshCatalogSyncProductStatus,
  sendCatalogSyncProductForUser,
  type CatalogSyncProductState,
  type CatalogSyncSourceProduct,
} from '@/services/catalogSync'

type TestProduct = CatalogSyncSourceProduct & {
  catalogSync: CatalogSyncProductState
  id: string
}

const product = (patch: Partial<TestProduct> = {}): TestProduct => ({
  brand: { id: 'brand-1', title: 'Марка' },
  catalogSync: {},
  categories: [{ ancestors: [], id: 'category-1', title: 'Категория' }],
  description: 'Подробно описание',
  id: 'product-1',
  images: [{ alt: 'Снимка', storageKey: 'products/product-1.jpg' }],
  manufacturerCode: 'ORIGINAL',
  originalSku: 'OR-1',
  price: 10,
  shortDescription: 'Кратко описание',
  sku: 'SKU-1',
  stockQty: 3,
  stockStatus: 'instock',
  title: 'Продукт',
  updatedAt: '2026-08-29T10:00:00.000Z',
  ...patch,
})

const request = () => {
  const updates: Array<Record<string, any>> = []
  const payload = {
    findGlobal: vi.fn().mockResolvedValue({
      notificationRecipients: [{ email: 'operations@example.com' }],
    }),
    logger: { error: vi.fn(), warn: vi.fn() },
    sendEmail: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(async (args) => {
      updates.push(args)
      return args.data
    }),
  }
  return { payload, req: { payload, user: { id: 'admin-1', roles: ['admin'] } } as any, updates }
}

describe('direct manual Romanian catalog synchronization', () => {
  it('loads the selected product with the authenticated administrator access', async () => {
    const source = product()
    const findByID = vi.fn(async ({ collection }) =>
      collection === 'products' ? source : { id: 'category-1', parent: null, title: 'Категория' },
    )
    const req = { payload: { findByID }, user: { id: 'admin-1', roles: ['admin'] } } as any

    await expect(loadCatalogSyncProductForUser({ productId: source.id, req })).resolves.toEqual(
      source,
    )
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        depth: 2,
        id: source.id,
        overrideAccess: false,
        req,
        user: req.user,
      }),
    )
  })

  it('sends the Catalog Sync 1.2 event directly and stores the remote event state', async () => {
    const source = product()
    const { req, updates } = request()
    const send = vi.fn(async (event) => ({ eventId: event.eventId, status: 'queued' }))

    const result = await sendCatalogSyncProductForUser({
      product: source,
      req,
      transport: { getStatus: vi.fn(), send },
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'product.upsert', schemaVersion: '1.2' }),
    )
    expect(result.response.status).toBe('queued')
    expect(getCatalogSyncProductStatus(result.product)).toMatchObject({
      approvalStatus: 'pending',
      contentStatus: 'pending',
      lastEventId: result.event.eventId,
      lastRemoteStatus: 'queued',
    })
    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'products',
        context: { skipProductReviewQueue: true },
        data: expect.objectContaining({ generateSlug: false }),
        req,
      }),
    )
  })

  it('uses the same deterministic event ID for an explicit retry of unchanged content', async () => {
    const source = product()
    const { req } = request()
    const sentEventIds: string[] = []
    const transport = {
      getStatus: vi.fn(),
      send: vi.fn(async (event) => {
        sentEventIds.push(event.eventId)
        return { eventId: event.eventId, status: 'queued' }
      }),
    }

    await sendCatalogSyncProductForUser({ product: source, req, transport })
    await sendCatalogSyncProductForUser({ product: source, req, transport })

    expect(sentEventIds).toEqual([
      buildCatalogSyncEvent(source).eventId,
      buildCatalogSyncEvent(source).eventId,
    ])
  })

  it('keeps retries stable across internal status writes and versions real A-B-A changes', async () => {
    let storedProduct = product()
    let clock = new Date('2026-08-30T08:00:00.000Z').getTime()
    const sentEvents: ReturnType<typeof buildCatalogSyncEvent>[] = []
    const payload = {
      findByID: vi.fn(async ({ collection }) =>
        collection === 'products'
          ? structuredClone(storedProduct)
          : { id: 'category-1', parent: null, title: 'Категория' },
      ),
      findGlobal: vi.fn().mockResolvedValue({ notificationRecipients: [] }),
      logger: { error: vi.fn(), warn: vi.fn() },
      sendEmail: vi.fn(),
      update: vi.fn(async ({ data }) => {
        clock += 1
        storedProduct = {
          ...storedProduct,
          catalogSync: data.catalogSync,
          updatedAt: new Date(clock).toISOString(),
        }
        return structuredClone(storedProduct)
      }),
    }
    const req = { payload, user: { id: 'admin-1', roles: ['admin'] } } as any
    const transport = {
      getStatus: vi.fn(),
      send: vi.fn(async (event) => {
        sentEvents.push(event)
        return { eventId: event.eventId, status: 'queued' }
      }),
    }
    const load = () => loadCatalogSyncProductForUser({ productId: storedProduct.id, req })
    const sendLoaded = async () =>
      sendCatalogSyncProductForUser({ product: await load(), req, transport })

    const firstA = await sendLoaded()
    const updatedAtAfterInternalWrites = storedProduct.updatedAt
    const retryA = await sendLoaded()

    expect(updatedAtAfterInternalWrites).not.toBe(firstA.event.sourceUpdatedAt)
    expect(retryA.event.eventId).toBe(firstA.event.eventId)
    expect(retryA.event.sourceUpdatedAt).toBe(firstA.event.sourceUpdatedAt)

    clock += 1_000
    storedProduct = {
      ...storedProduct,
      title: 'Версия B',
      updatedAt: new Date(clock).toISOString(),
    }
    const versionB = await sendLoaded()
    expect(versionB.event.eventId).not.toBe(firstA.event.eventId)

    clock += 1_000
    storedProduct = {
      ...storedProduct,
      title: product().title,
      updatedAt: new Date(clock).toISOString(),
    }
    const secondA = await sendLoaded()

    expect(secondA.event.eventId).not.toBe(firstA.event.eventId)
    expect(secondA.event.eventId).not.toBe(versionB.event.eventId)
    expect(new Date(secondA.event.sourceUpdatedAt).getTime()).toBeGreaterThan(
      new Date(versionB.event.sourceUpdatedAt).getTime(),
    )
    expect(sentEvents).toHaveLength(4)
  })

  it('tracks translation and then marks the same content event as successful', async () => {
    const source = product()
    const event = buildCatalogSyncEvent(source)
    const fingerprint = buildCatalogSyncContentFingerprint(source)
    const pending = product({
      catalogSync: {
        approvalStatus: 'pending',
        contentStatus: 'pending',
        lastEventId: event.eventId,
        lastRemoteStatus: 'queued',
        pendingContentFingerprint: fingerprint,
      },
    })
    const { req } = request()
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({ eventId: event.eventId, status: 'translating' })
      .mockResolvedValueOnce({ eventId: event.eventId, status: 'succeeded' })
    const transport = { getStatus, send: vi.fn() }

    const translating = await refreshCatalogSyncProductStatus({ product: pending, req, transport })
    expect(getCatalogSyncProductStatus(translating)).toMatchObject({
      contentStatus: 'pending',
      lastRemoteStatus: 'translating',
    })

    const succeeded = await refreshCatalogSyncProductStatus({
      product: translating,
      req,
      transport,
    })
    expect(getCatalogSyncProductStatus(succeeded)).toMatchObject({
      approved: true,
      approvalStatus: 'approved',
      contentStatus: 'current',
      lastRemoteStatus: 'succeeded',
      lastSuccessfulEventId: event.eventId,
    })
  })

  it('detects edited content after the last successful fingerprint without an automatic hook', () => {
    const baseline = product()
    const lastContentFingerprint = buildCatalogSyncContentFingerprint(baseline)
    const changed = product({
      catalogSync: {
        approved: true,
        approvalStatus: 'approved',
        contentStatus: 'current',
        lastContentFingerprint,
      },
      description: 'Редактирано описание',
    })

    expect(getCatalogSyncProductStatus(changed).contentStatus).toBe('changed')
    expect(buildCatalogSyncContentFingerprint(product({ price: 12, stockQty: 9 }))).toBe(
      lastContentFingerprint,
    )
  })

  it('records and emails a synchronously observed send failure', async () => {
    const source = product()
    const event = buildCatalogSyncEvent(source)
    const { payload, req, updates } = request()

    await expect(
      sendCatalogSyncProductForUser({
        product: source,
        req,
        transport: {
          getStatus: vi.fn(),
          send: vi.fn().mockRejectedValue(new Error('fetch failed')),
        },
      }),
    ).rejects.toThrow('fetch failed')

    expect(updates).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          catalogSync: expect.objectContaining({
            contentStatus: 'error',
            lastError: 'fetch failed',
            lastErrorAt: expect.any(String),
            lastEventId: event.eventId,
          }),
          generateSlug: false,
        }),
      }),
    )
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Грешка при изпращане към румънския сайт'),
        to: 'operations@example.com',
      }),
    )
  })

  it('records and emails an asynchronously observed Romanian failure only once per attempt', async () => {
    const source = product()
    const event = buildCatalogSyncEvent(source)
    const pending = product({
      catalogSync: {
        approvalStatus: 'pending',
        contentStatus: 'pending',
        lastEventId: event.eventId,
        pendingContentFingerprint: buildCatalogSyncContentFingerprint(source),
      },
    })
    const { payload, req } = request()
    const transport = {
      getStatus: vi.fn().mockResolvedValue({
        error: 'Translation failed',
        eventId: event.eventId,
        status: 'failed',
      }),
      send: vi.fn(),
    }

    const failed = await refreshCatalogSyncProductStatus({ product: pending, req, transport })
    expect(getCatalogSyncProductStatus(failed)).toMatchObject({
      approvalStatus: 'error',
      contentStatus: 'error',
      lastError: 'Translation failed',
      lastErrorAt: expect.any(String),
    })
    expect(payload.sendEmail).toHaveBeenCalledOnce()

    await refreshCatalogSyncProductStatus({ product: failed, req, transport })
    expect(payload.sendEmail).toHaveBeenCalledOnce()
  })

  it('keeps secrets, RO URLs, commerce state, and worker concepts out of the admin client', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/components/admin/UploadToRomaniaButton.tsx'),
      'utf8',
    )
    expect(source).not.toContain('CATALOG_SYNC_API_KEY')
    expect(source).not.toContain('ibis-electronics.ro/api')
    expect(source).not.toMatch(/commerce|worker|outbox/iu)
    expect(source).toContain('/api/maintenance/products/')
  })
})
