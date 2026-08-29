import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { syncRomanianCatalogAfterChange } from '@/collections/Products/hooks/syncRomanianCatalog'
import { catalogSyncAdminSendHandler } from '@/endpoints/catalogSyncAdmin'
import {
  buildCatalogSyncEvent,
  buildCatalogSyncFingerprints,
  enqueueCatalogContentSync,
  processCatalogSyncOutboxItem,
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
  categories: [{ id: 'category-1', title: 'Категория' }],
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

const adminUser = { id: 'admin-1', roles: ['admin'] }

describe('controlled Romanian catalog synchronization', () => {
  it('creates the initial outbox item only through the authenticated manual endpoint', async () => {
    let outbox: Record<string, any> | null = null
    let productRecord = product()
    const payload = {
      create: vi.fn(async ({ data }) => {
        outbox = { ...data, id: 'outbox-1' }
        return outbox
      }),
      find: vi.fn(async () => ({ docs: outbox ? [outbox] : [] })),
      findByID: vi.fn(async () => productRecord),
      update: vi.fn(async ({ collection, data }) => {
        if (collection === 'products') {
          productRecord = { ...productRecord, catalogSync: data.catalogSync }
        }
        return data
      }),
    }
    const req = {
      payload,
      routeParams: { id: 'product-1' },
      user: adminUser,
    } as any

    const response = await catalogSyncAdminSendHandler(req)
    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toMatchObject({
      approvalStatus: 'pending',
      message: 'Продуктът е добавен в опашката за румънския сайт.',
    })
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: false, user: adminUser }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'catalog-sync-outbox',
        data: expect.objectContaining({ action: 'initial', status: 'pending' }),
      }),
    )
  })

  it('reuses one deterministic outbox item for repeated manual clicks', async () => {
    let outbox: Record<string, any> | null = null
    const req = {
      payload: {
        create: vi.fn(async ({ data }) => {
          outbox = { ...data, id: 'outbox-1' }
          return outbox
        }),
        find: vi.fn(async () => ({ docs: outbox ? [outbox] : [] })),
        update: vi.fn().mockResolvedValue({}),
      },
    } as any
    const source = product()

    const first = await enqueueCatalogContentSync({ product: source, req })
    const second = await enqueueCatalogContentSync({ product: source, req })

    expect(first.reused).toBe(false)
    expect(second.reused).toBe(true)
    expect(first.event.eventId).toBe(second.event.eventId)
    expect(req.payload.create).toHaveBeenCalledOnce()
  })

  it('does not enqueue automatic work before manual approval', async () => {
    const req = { payload: { create: vi.fn(), findByID: vi.fn(), update: vi.fn() } } as any

    await syncRomanianCatalogAfterChange({
      context: {},
      doc: product({ catalogSync: { approved: false } }),
      req,
    } as any)

    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it('records approved commerce drift durably but keeps it contract-blocked', async () => {
    const baseline = product()
    const fingerprints = buildCatalogSyncFingerprints(baseline)
    const changed = product({
      catalogSync: {
        approved: true,
        lastCommerceFingerprint: fingerprints.commerce,
        lastContentFingerprint: fingerprints.content,
      },
      price: 12,
    })
    const req = {
      payload: {
        create: vi.fn().mockResolvedValue({ id: 'commerce-outbox' }),
        find: vi.fn().mockResolvedValue({ docs: [] }),
        findByID: vi.fn().mockResolvedValue(changed),
        logger: { error: vi.fn() },
        update: vi.fn().mockResolvedValue({}),
      },
    } as any

    await syncRomanianCatalogAfterChange({ context: {}, doc: changed, req } as any)

    expect(req.payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'commerce', status: 'blocked_contract' }),
      }),
    )
    expect(req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { skipRomanianCatalogSync: true },
        data: expect.objectContaining({
          catalogSync: expect.objectContaining({
            commerceStatus: 'blocked_contract',
            contentStatus: 'current',
          }),
        }),
      }),
    )
  })

  it('marks approved content drift without enqueueing a content event', async () => {
    const baseline = product()
    const fingerprints = buildCatalogSyncFingerprints(baseline)
    const changed = product({
      catalogSync: {
        approved: true,
        lastCommerceFingerprint: fingerprints.commerce,
        lastContentFingerprint: fingerprints.content,
      },
      description: 'Редактирано описание',
    })
    const req = {
      payload: {
        create: vi.fn(),
        find: vi.fn(),
        findByID: vi.fn().mockResolvedValue(changed),
        logger: { error: vi.fn() },
        update: vi.fn().mockResolvedValue({}),
      },
    } as any

    await syncRomanianCatalogAfterChange({ context: {}, doc: changed, req } as any)

    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          catalogSync: expect.objectContaining({ contentStatus: 'changed' }),
        }),
      }),
    )
  })

  it('keeps content and commerce fingerprints deterministic and independent', () => {
    const baseline = buildCatalogSyncFingerprints(product())
    expect(buildCatalogSyncFingerprints(structuredClone(product()))).toEqual(baseline)

    const priceChange = buildCatalogSyncFingerprints(product({ price: 11 }))
    expect(priceChange.content).toBe(baseline.content)
    expect(priceChange.commerce).not.toBe(baseline.commerce)

    const contentChange = buildCatalogSyncFingerprints(product({ description: 'Ново описание' }))
    expect(contentChange.content).not.toBe(baseline.content)
    expect(contentChange.commerce).toBe(baseline.commerce)
  })

  it('keeps a failed network delivery retryable with the same event ID', async () => {
    const source = product()
    const event = buildCatalogSyncEvent(source)
    const fingerprints = buildCatalogSyncFingerprints(source)
    const updates: Array<Record<string, any>> = []
    const req = {
      payload: {
        findByID: vi.fn().mockResolvedValue(product()),
        update: vi.fn(async (args) => {
          updates.push(args)
          return args.data
        }),
      },
    } as any

    await processCatalogSyncOutboxItem({
      item: {
        action: 'initial',
        attempts: 0,
        commerceFingerprint: fingerprints.commerce,
        contentFingerprint: fingerprints.content,
        createdAt: '2026-08-29T10:00:00.000Z',
        dedupeKey: `initial:${event.eventId}`,
        eventId: event.eventId,
        eventPayload: event,
        id: 'outbox-1',
        product: 'product-1',
        status: 'pending',
        updatedAt: '2026-08-29T10:00:00.000Z',
      },
      req,
      transport: {
        getStatus: vi.fn(),
        send: vi.fn().mockRejectedValue(new Error('fetch failed')),
      },
    })

    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'catalog-sync-outbox',
        data: expect.objectContaining({ attempts: 1, status: 'retry_wait' }),
        id: 'outbox-1',
      }),
    )
    expect(event.eventId).toBe(buildCatalogSyncEvent(source).eventId)
  })

  it('marks the product approved only after a successful Romanian result', async () => {
    const source = product()
    const event = buildCatalogSyncEvent(source)
    const fingerprints = buildCatalogSyncFingerprints(source)
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

    await processCatalogSyncOutboxItem({
      item: {
        action: 'initial',
        attempts: 0,
        commerceFingerprint: fingerprints.commerce,
        contentFingerprint: fingerprints.content,
        createdAt: '2026-08-29T10:00:00.000Z',
        dedupeKey: `initial:${event.eventId}`,
        eventId: event.eventId,
        eventPayload: event,
        id: 'outbox-1',
        product: 'product-1',
        status: 'pending',
        updatedAt: '2026-08-29T10:00:00.000Z',
      },
      req,
      transport: {
        getStatus: vi.fn(),
        send: vi.fn().mockResolvedValue({ eventId: event.eventId, status: 'succeeded' }),
      },
    })

    expect(updates).toContainEqual(
      expect.objectContaining({
        collection: 'products',
        context: { skipRomanianCatalogSync: true },
        data: expect.objectContaining({
          catalogSync: expect.objectContaining({
            approved: true,
            approvalStatus: 'approved',
            lastSuccessfulEventId: event.eventId,
          }),
        }),
      }),
    )
  })

  it('skips all synchronization work for recursion-guarded writes', async () => {
    const req = { payload: { findByID: vi.fn(), update: vi.fn() } } as any
    await syncRomanianCatalogAfterChange({
      context: { skipRomanianCatalogSync: true },
      doc: product({ catalogSync: { approved: true } }),
      req,
    } as any)
    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('keeps the API key and Romanian endpoint out of the client component', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/components/admin/UploadToRomaniaButton.tsx'),
      'utf8',
    )
    expect(source).not.toContain('CATALOG_SYNC_API_KEY')
    expect(source).not.toContain('ibis-electronics.ro/api')
    expect(source).toContain('/api/maintenance/products/')
  })
})
