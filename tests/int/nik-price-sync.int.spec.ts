import { afterEach, describe, expect, it, vi } from 'vitest'
import { slugField, type FieldHook, type PayloadRequest } from 'payload'

vi.mock('@/utilities/uploadProductImagesToR2', () => ({
  uploadProductImagesToR2: vi.fn(),
}))

import { nikPriceSyncHandler } from '@/endpoints/nik-price-sync'

afterEach(() => vi.unstubAllEnvs())

const setup = (event: string, enabled = true) => {
  vi.stubEnv('NIK_SYNC_WEBHOOK_SECRET', 'test-secret')
  vi.stubEnv('NIK_SYNC_FORCE_DISABLED', 'false')
  // Migrated records have a valid URL but no generateSlug flag.
  const product = {
    id: 'product-id',
    sku: '301SU02OR',
    sourceId: 61649,
    slug: '301su02or-61649',
    title: 'Original title',
    description: 'Original description',
    stockQty: 1,
  }
  const update = vi.fn(async ({ data, req: updateReq }) => {
    const row = slugField()
    if (!('fields' in row)) throw new Error('Expected slug row')
    const checkbox = row.fields.find((field) => 'name' in field && field.name === 'generateSlug')
    if (!checkbox || !('hooks' in checkbox)) throw new Error('Expected slug checkbox')
    const hook = checkbox.hooks?.beforeChange?.[0] as FieldHook
    const nextData = { ...product, ...data }
    await hook({
      operation: 'update',
      data: nextData,
      originalDoc: product,
      value: data.generateSlug ?? true,
      collection: { versions: false },
      req: updateReq,
    } as unknown as Parameters<FieldHook>[0])
    return nextData
  })
  const req = {
    headers: new Headers({ 'x-webhook-secret': 'test-secret' }),
    json: async () => ({
      event,
      items: [{ sku: product.sku, data: { sourcePrice: 42, stockQty: 0 } }],
    }),
    payload: {
      findGlobal: vi.fn(async () => ({ nikSyncEnabled: enabled, markupPercent: 15 })),
      find: vi.fn(async () => ({ docs: [product] })),
      update,
      delete: vi.fn(async () => product),
    },
  } as unknown as PayloadRequest
  return { req, update, product }
}

describe('NIK product synchronization', () => {
  it('updates stock to zero without regenerating a migrated product URL or changing editorial data', async () => {
    const { req, update, product } = setup('product.price_stock_updated')
    const response = await nikPriceSyncHandler(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ updated: 1, invalid: 0 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: product.id,
        req,
        data: {
          generateSlug: false,
          price: 48.3,
          sourcePrice: 42,
          stockQty: 0,
          stockStatus: 'outofstock',
        },
      }),
    )
    expect(await update.mock.results[0].value).toMatchObject({
      slug: product.slug,
      title: product.title,
      description: product.description,
      stockQty: 0,
    })
  })

  it('preserves the URL on deactivation and uses the request context', async () => {
    const { req, update } = setup('product.deactivated')
    const response = await nikPriceSyncHandler(req)
    expect(await response.json()).toMatchObject({ deactivated: 1 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        data: { generateSlug: false, published: false },
      }),
    )
  })

  it('does not write when synchronization is disabled in the admin', async () => {
    const { req, update } = setup('product.price_stock_updated', false)
    expect((await nikPriceSyncHandler(req)).status).toBe(503)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated updates', async () => {
    const { req, update } = setup('product.price_stock_updated')
    req.headers.set('x-webhook-secret', 'wrong')
    expect((await nikPriceSyncHandler(req)).status).toBe(401)
    expect(update).not.toHaveBeenCalled()
  })
})
