import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
vi.mock('@/merchant/tasks', () => ({ queueMerchantProduct: vi.fn() }))
import { queueMerchantProduct } from '@/merchant/tasks'
import { ProductsCollection } from '@/collections/Products'
import { isEnglishTextOnlyProductChange } from '@/i18n/productChanges'
import { syncProductReviewQueueAfterChange } from '@/collections/Products/hooks/syncProductReviewQueue'

const previousDoc = {
  id: 'p',
  title: 'Old',
  description: 'Old',
  price: 10,
  stockQty: 2,
  published: true,
  slug: 'stable',
  meta: { title: 'Old SEO', image: 'image' },
}
const doc = {
  ...previousDoc,
  title: 'New',
  description: 'New',
  updatedAt: 'new',
  meta: { title: 'New SEO', image: 'image' },
}

describe('English-only product edits', () => {
  it('recognizes text changes without treating shared data as localized', () => {
    expect(
      isEnglishTextOnlyProductChange({ doc, previousDoc, operation: 'update', locale: 'en' }),
    ).toBe(true)
    expect(
      isEnglishTextOnlyProductChange({ doc, previousDoc, operation: 'update', locale: 'bg' }),
    ).toBe(false)
    expect(isEnglishTextOnlyProductChange({ doc, operation: 'update', locale: 'en' })).toBe(false)
    expect(
      isEnglishTextOnlyProductChange({ doc, previousDoc, operation: 'create', locale: 'en' }),
    ).toBe(false)
  })
  it.each([
    { price: 12 },
    { stockQty: 0 },
    { published: false },
    { slug: 'changed' },
    { categories: ['other'] },
    { meta: { title: 'New SEO', image: 'other' } },
  ])('preserves propagation for shared changes %j', (change) => {
    expect(
      isEnglishTextOnlyProductChange({
        doc: { ...doc, ...change },
        previousDoc,
        operation: 'update',
        locale: 'en',
      }),
    ).toBe(false)
  })
  it('queues Merchant for shared changes but not for an EN text-only save', async () => {
    const collection = await ProductsCollection({
      defaultCollection: { slug: 'products', fields: [] },
    })
    const hook = collection.hooks!.afterChange!.at(-1)!
    const args = {
      doc,
      previousDoc,
      operation: 'update',
      req: { locale: 'en' },
      context: {},
    } as unknown as Parameters<typeof hook>[0]
    vi.mocked(queueMerchantProduct).mockClear()
    await hook(args)
    expect(queueMerchantProduct).not.toHaveBeenCalled()
    await hook({ ...args, doc: { ...doc, stockQty: 0 } })
    expect(queueMerchantProduct).toHaveBeenCalledWith('p', args.req)
  })
  it('does not mark the product reviewed when an admin only translates it', async () => {
    const find = vi.fn(async () => ({ docs: [] }))
    const req = {
      locale: 'en',
      user: { id: 'admin', roles: ['admin'] },
      payload: { find },
    } as unknown as PayloadRequest
    const args = {
      doc,
      previousDoc,
      operation: 'update',
      req,
      context: {},
    } as unknown as Parameters<typeof syncProductReviewQueueAfterChange>[0]
    await syncProductReviewQueueAfterChange(args)
    expect(find).not.toHaveBeenCalled()
    await syncProductReviewQueueAfterChange({ ...args, doc: { ...doc, price: 12 } })
    expect(find).toHaveBeenCalledOnce()
  })
})
