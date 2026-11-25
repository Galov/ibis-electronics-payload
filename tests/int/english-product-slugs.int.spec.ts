// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { englishSlugBase, planEnglishSlugBackfill } from '@/i18n/englishProductSlugs.mjs'
import { productHref, productLanguageSwitchHref } from '@/i18n/productHref'
const product = (n: number, title: string, slug: string, extra = {}) => ({
  _id: n.toString(16).padStart(24, '0'),
  title: { en: title },
  slug,
  ...extra,
})
describe('stable English product routes', () => {
  it('keeps technical values and creates ASCII routes from English titles', () => {
    expect(englishSlugBase('90 Degree Thermal Cut-Off for Water Heater')).toBe(
      '90-degree-thermal-cut-off-for-water-heater',
    )
    expect(englishSlugBase('Café 12.5 mm & 30W')).toBe('cafe-12-5-mm-and-30w')
  })
  it('reserves Bulgarian and legacy routes, handles duplicate titles deterministically', () => {
    const docs = [
      product(1, 'Pump', 'помпа'),
      product(2, 'Pump', 'pump'),
      product(3, 'Pump', 'трета'),
      product(4, '', 'четвърта'),
    ]
    const before = JSON.stringify(docs)
    const rows = planEnglishSlugBackfill(docs)
    expect(rows).toHaveLength(3)
    expect(rows[0].patch.englishSlug).toBe(`pump-${docs[0]._id}`)
    expect(rows[1].patch.englishSlug).toBe('pump')
    expect(rows[2].patch.englishSlug).toBe(`pump-${docs[2]._id}`)
    expect(rows[0].patch.englishLegacySlug).toBe('помпа')
    expect(planEnglishSlugBackfill([...docs].reverse())).toEqual(rows)
    expect(JSON.stringify(docs)).toBe(before)
    const saved = docs.map((doc) => ({
      ...doc,
      ...rows.find((r) => r.id === doc._id)?.patch,
      title: { en: 'Changed title' },
    }))
    expect(planEnglishSlugBackfill(saved)).toHaveLength(1)
    expect(planEnglishSlugBackfill(saved)[0].id).toBe(docs[3]._id)
  })
  it('uses the right locale and maps language changes through a same-origin route', () => {
    const doc = { slug: 'защита-5', englishSlug: 'thermal-cut-off' }
    expect(productHref(doc, 'en')).toBe('/en/products/thermal-cut-off')
    expect(decodeURIComponent(productHref(doc, 'bg'))).toBe('/products/защита-5')
    expect(productLanguageSwitchHref('/en/products/thermal-cut-off?q=1#spec', 'bg')).toBe(
      '/api/storefront-language?locale=bg&path=%2Fen%2Fproducts%2Fthermal-cut-off%3Fq%3D1%23spec',
    )
    expect(productLanguageSwitchHref('/en/magazin', 'bg')).toBeNull()
  })
})
