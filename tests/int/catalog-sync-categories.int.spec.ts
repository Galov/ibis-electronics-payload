import { describe, expect, it, vi } from 'vitest'

import {
  buildCatalogSyncEvent,
  loadCatalogSyncProductForUser,
  resolveCatalogSyncCategoryPaths,
  sendCatalogSyncProductForUser,
  validateCatalogSyncEvent,
  type CatalogSyncSourceCategory,
  type CatalogSyncSourceProduct,
} from '@/services/catalogSync'

type CategoryRecord = {
  id: string
  parent: null | string
  title: string
}

const sourceProduct = (
  categories: CatalogSyncSourceProduct['categories'],
): CatalogSyncSourceProduct => ({
  brand: { id: 'brand-1', title: 'Марка' },
  categories,
  description: 'Описание',
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
  updatedAt: '2026-08-30T10:00:00.000Z',
})

const categoryFinder = (records: CategoryRecord[]) => {
  const byID = new Map(records.map((record) => [record.id, record]))
  return vi.fn(async (id: string) => {
    const category = byID.get(id)
    if (!category) throw new Error(`Missing category ${id}`)
    return structuredClone(category)
  })
}

const resolve = async (records: CategoryRecord[], assigned: string[]) => {
  const findCategoryByID = categoryFinder(records)
  const categories = await resolveCatalogSyncCategoryPaths({
    categories: assigned,
    findCategoryByID,
  })
  return { categories, findCategoryByID }
}

const adminRequest = (product: CatalogSyncSourceProduct, records: CategoryRecord[]) => {
  const findCategoryByID = categoryFinder(records)
  const payload = {
    findByID: vi.fn(async ({ collection, id }) => {
      if (collection === 'products') return structuredClone(product)
      return findCategoryByID(String(id))
    }),
    findGlobal: vi.fn().mockResolvedValue({ notificationRecipients: [] }),
    logger: { error: vi.fn(), warn: vi.fn() },
    sendEmail: vi.fn(),
    update: vi.fn(async ({ data }) => data),
  }
  return {
    findCategoryByID,
    req: { payload, user: { id: 'admin-1', roles: ['admin'] } } as any,
  }
}

describe('Catalog Sync 1.2 category hierarchy', () => {
  it('uses an empty ancestors list for a root category', async () => {
    const { categories } = await resolve(
      [{ id: 'root', parent: null, title: 'Категории' }],
      ['root'],
    )

    expect(categories).toEqual([{ ancestors: [], id: 'root', title: 'Категории' }])
  })

  it('orders a multi-level path from the root to the immediate parent', async () => {
    const { categories } = await resolve(
      [
        { id: 'root', parent: null, title: 'Категории' },
        { id: 'parts', parent: 'root', title: 'Резервни части' },
        { id: 'washers', parent: 'parts', title: 'Перални' },
        { id: 'pumps', parent: 'washers', title: 'Помпи' },
      ],
      ['pumps'],
    )

    expect(categories).toEqual([
      {
        ancestors: [
          { sourceCategoryId: 'root', title: 'Категории' },
          { sourceCategoryId: 'parts', title: 'Резервни части' },
          { sourceCategoryId: 'washers', title: 'Перални' },
        ],
        id: 'pumps',
        title: 'Помпи',
      },
    ])
  })

  it('reuses shared parents and returns only the categories assigned to the product', async () => {
    const { categories, findCategoryByID } = await resolve(
      [
        { id: 'root', parent: null, title: 'Категории' },
        { id: 'parts', parent: 'root', title: 'Резервни части' },
        { id: 'pumps', parent: 'parts', title: 'Помпи' },
        { id: 'motors', parent: 'parts', title: 'Мотори' },
      ],
      ['pumps', 'motors'],
    )

    expect(categories.map((category) => category.id)).toEqual(['pumps', 'motors'])
    expect(categories.flatMap((category) => category.ancestors).map((item) => item.title)).toEqual([
      'Категории',
      'Резервни части',
      'Категории',
      'Резервни части',
    ])
    expect(findCategoryByID.mock.calls.filter(([id]) => id === 'root')).toHaveLength(1)
    expect(findCategoryByID.mock.calls.filter(([id]) => id === 'parts')).toHaveLength(1)
    expect(
      buildCatalogSyncEvent(sourceProduct(categories)).product.categories.map(
        (category) => category.sourceCategoryId,
      ),
    ).toEqual(['pumps', 'motors'])
  })

  it('stops safely when the category path exceeds the maximum depth', async () => {
    const records = Array.from({ length: 34 }, (_, index) => ({
      id: `level-${index}`,
      parent: index === 0 ? null : `level-${index - 1}`,
      title: `Ниво ${index}`,
    }))

    await expect(resolve(records, ['level-33'])).rejects.toMatchObject({
      code: 'CATALOG_SYNC_CATEGORY_DEPTH_EXCEEDED',
    })
  })

  it.each([
    {
      code: 'CATALOG_SYNC_CATEGORY_CYCLE',
      name: 'cyclic parent relation',
      records: [
        { id: 'a', parent: 'b', title: 'A' },
        { id: 'b', parent: 'a', title: 'B' },
      ],
    },
    {
      code: 'CATALOG_SYNC_CATEGORY_MISSING',
      name: 'missing parent',
      records: [{ id: 'a', parent: 'missing', title: 'A' }],
    },
  ])('stops before transport for a $name', async ({ code, records }) => {
    const product = sourceProduct(['a'])
    const { req } = adminRequest(product, records)
    const send = vi.fn()

    const attempt = async () => {
      const loaded = await loadCatalogSyncProductForUser({ productId: String(product.id), req })
      return sendCatalogSyncProductForUser({
        product: loaded,
        req,
        transport: { getStatus: vi.fn(), send },
      })
    }

    await expect(attempt()).rejects.toMatchObject({ code })
    expect(send).not.toHaveBeenCalled()
  })

  it('changes the content hash and event ID when a parent or path title changes', async () => {
    const initial = await resolve(
      [
        { id: 'root', parent: null, title: 'Категории' },
        { id: 'parts', parent: 'root', title: 'Резервни части' },
        { id: 'pumps', parent: 'parts', title: 'Помпи' },
      ],
      ['pumps'],
    )
    const renamed = await resolve(
      [
        { id: 'root', parent: null, title: 'Каталог' },
        { id: 'parts', parent: 'root', title: 'Резервни части' },
        { id: 'pumps', parent: 'parts', title: 'Помпи' },
      ],
      ['pumps'],
    )
    const reparented = await resolve(
      [
        { id: 'other-root', parent: null, title: 'Друг каталог' },
        { id: 'parts', parent: 'other-root', title: 'Резервни части' },
        { id: 'pumps', parent: 'parts', title: 'Помпи' },
      ],
      ['pumps'],
    )

    const first = buildCatalogSyncEvent(sourceProduct(initial.categories))
    const same = buildCatalogSyncEvent(sourceProduct(structuredClone(initial.categories)))
    const titleChanged = buildCatalogSyncEvent(sourceProduct(renamed.categories))
    const parentChanged = buildCatalogSyncEvent(sourceProduct(reparented.categories))

    expect(same.sourceContentHash).toBe(first.sourceContentHash)
    expect(same.eventId).toBe(first.eventId)
    expect(titleChanged.sourceContentHash).not.toBe(first.sourceContentHash)
    expect(titleChanged.eventId).not.toBe(first.eventId)
    expect(parentChanged.sourceContentHash).not.toBe(first.sourceContentHash)
    expect(parentChanged.eventId).not.toBe(first.eventId)
  })

  it('emits the exact 1.2/1.1 category contract and rejects extra fields', () => {
    const category: CatalogSyncSourceCategory = {
      ancestors: [{ sourceCategoryId: 'root', title: 'Категории' }],
      id: 'pumps',
      title: 'Помпи',
    }
    const event = buildCatalogSyncEvent(sourceProduct([category]))

    expect(event).toMatchObject({
      product: {
        categories: [
          {
            ancestors: [{ sourceCategoryId: 'root', title: 'Категории' }],
            sourceCategoryId: 'pumps',
            title: 'Помпи',
          },
        ],
        schemaVersion: '1.1',
      },
      schemaVersion: '1.2',
    })
    expect(Object.keys(event.product.categories[0] || {}).sort()).toEqual(
      ['ancestors', 'sourceCategoryId', 'title'].sort(),
    )

    const invalid = structuredClone(event) as typeof event & {
      product: typeof event.product & {
        categories: ((typeof event.product.categories)[number] & { extra?: boolean })[]
      }
    }
    invalid.product.categories[0]!.extra = true
    expect(() => validateCatalogSyncEvent(invalid)).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_CONTRACT' }),
    )

    const invalidAncestor = structuredClone(event)
    Object.assign(invalidAncestor.product.categories[0]!.ancestors[0]!, { extra: true })
    expect(() => validateCatalogSyncEvent(invalidAncestor)).toThrowError(
      expect.objectContaining({ code: 'CATALOG_SYNC_INVALID_CONTRACT' }),
    )
  })
})
