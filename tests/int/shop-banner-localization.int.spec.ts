import { describe, expect, it } from 'vitest'
import { planShopBannerLocalization } from '@/i18n/shopBannerMigration'

describe('independent catalog banners', () => {
  it('preserves all legacy BG banner settings, including false and empty values', () => {
    const doc = {
      topBanner: { image: 'image-id', url: '/bg-offer', openInNewTab: false },
      bottomBanner: { image: null, url: '', openInNewTab: false },
      productBanner: { image: 'product-image', openInNewTab: true },
      unrelated: 123,
    }
    const plan = planShopBannerLocalization(doc)
    expect(plan.after).toEqual({
      topBanner: { bg: doc.topBanner },
      bottomBanner: { bg: doc.bottomBanner },
      productBanner: { bg: doc.productBanner },
    })
    expect(planShopBannerLocalization({ ...doc, ...plan.after }).after).toEqual({})
    expect(doc.topBanner.image).toBe('image-id')
  })
  it('never overwrites existing localized banners and refuses mixed data', () => {
    expect(
      planShopBannerLocalization({ topBanner: { bg: { image: 'bg' }, en: { image: 'en' } } }).after,
    ).toEqual({})
    expect(() => planShopBannerLocalization({ topBanner: { image: 'legacy', en: {} } })).toThrow(
      'Mixed',
    )
  })
})
