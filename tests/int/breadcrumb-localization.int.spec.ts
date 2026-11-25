import { describe, expect, it } from 'vitest'
import {
  buildCategoryBreadcrumbItems,
  buildProductBreadcrumbItems,
  buildBreadcrumbSchema,
} from '@/utilities/schema'

const category = {
  title: 'Амортисьори',
  slug: 'amortisyori',
  parent: { title: 'Перални', slug: 'peralni' },
}
describe('localized breadcrumbs', () => {
  it('translates product category ancestry and keeps every EN link on the English storefront', () => {
    const items = buildProductBreadcrumbItems({
      locale: 'en',
      category,
      productName: 'Shock Absorber ABC123 80N',
      productSlug: 'part-abc123',
    })
    expect(items.map((item) => item.name)).toEqual([
      'Home',
      'Products',
      'Washing machines',
      'Shock absorbers',
      'Shock Absorber ABC123 80N',
    ])
    expect(items.every((item) => item.path === '/en' || item.path.startsWith('/en/'))).toBe(true)
    expect(items.at(-1)?.path).toBe('/en/products/part-abc123')
    expect(buildBreadcrumbSchema(items).itemListElement.at(-1)?.name).toBe(
      'Shock Absorber ABC123 80N',
    )
  })
  it('translates the category breadcrumb for structured data, including Home and Products', () => {
    const items = buildCategoryBreadcrumbItems({ category, locale: 'en' })
    expect(items.map((item) => item.name)).toEqual([
      'Home',
      'Products',
      'Washing machines',
      'Shock absorbers',
    ])
    expect(items.every((item) => item.path.startsWith('/en'))).toBe(true)
  })
  it('preserves existing Bulgarian labels, URLs and source data', () => {
    const items = buildProductBreadcrumbItems({
      category,
      productName: 'Амортисьор ABC123 80N',
      productSlug: 'part-abc123',
    })
    expect(items.map((item) => item.name)).toEqual([
      'Начало',
      'Каталог',
      'Перални',
      'Амортисьори',
      'Амортисьор ABC123 80N',
    ])
    expect(items.slice(0, 2).map((item) => item.path)).toEqual(['/', '/magazin'])
    expect(category.title).toBe('Амортисьори')
  })
})
