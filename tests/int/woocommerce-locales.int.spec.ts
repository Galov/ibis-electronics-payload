import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedProduct } from '../../scripts/woocommerce/types'
const mocks = vi.hoisted(() => ({ getPayload: vi.fn() }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('../../src/payload.config', () => ({ default: {} }))
import { importIntoPayload } from '../../scripts/woocommerce/payloadImport'

const product: NormalizedProduct = {
  sourceId: 1,
  title: 'Ново име',
  slug: 'new-title',
  categorySourceTaxonomyIds: [],
  price: 10,
  stockQty: 2,
  stockStatus: 'instock',
  manageStock: true,
  backordersAllowed: false,
  imagesMigrated: false,
  images: [],
  legacyAttachmentIDs: [],
  published: true,
}

beforeEach(() => vi.clearAllMocks())
describe('WooCommerce import language contract', () => {
  it.each([false, true])(
    'uses BG for product %s creation/update without locale-all writes',
    async (existing) => {
      const payload = {
        config: { localization: { locales: ['bg', 'en'] } },
        find: vi.fn(async ({ collection }) => ({
          docs:
            collection === 'products' && existing ? [{ id: 'p', sourceId: 1, slug: 'stable' }] : [],
          hasNextPage: false,
        })),
        create: vi.fn(async ({ data }) => ({ id: 'p', ...data })),
        update: vi.fn(async ({ data }) => ({ id: 'p', ...data })),
      }
      mocks.getPayload.mockResolvedValue(payload)
      const report = await importIntoPayload({
        batchSize: 10,
        brands: [],
        categories: [],
        products: [product],
        replaceCatalog: false,
      })
      expect(report.failedProducts).toEqual([])
      const write = existing ? payload.update : payload.create
      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'products',
          locale: 'bg',
          fallbackLocale: false,
          data: expect.objectContaining({ title: 'Ново име' }),
        }),
      )
      if (existing)
        expect(write.mock.calls[0][0].data).toMatchObject({ slug: 'stable', generateSlug: false })
    },
  )
  it('blocks destructive replacement once localization is enabled', async () => {
    const find = vi.fn()
    mocks.getPayload.mockResolvedValue({
      config: { localization: { locales: ['bg', 'en'] } },
      find,
    })
    await expect(
      importIntoPayload({
        batchSize: 10,
        brands: [],
        categories: [],
        products: [],
        replaceCatalog: true,
      }),
    ).rejects.toThrow('Catalog replacement is disabled')
    expect(find).not.toHaveBeenCalled()
  })
})
