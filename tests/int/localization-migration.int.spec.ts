import { describe, expect, it } from 'vitest'
import {
  planLocalization,
  rehearseLocalization,
  type Snapshot,
} from '../../scripts/localization/plan'

const fixture = (): Snapshot => ({
  products: [
    {
      _id: { $oid: '012345678901234567890123' },
      title: 'Продукт',
      description: '',
      shortDescription: null,
      meta: { title: 'SEO', image: 'image-id' },
      price: 12,
      stockQty: 7,
      sku: 'SKU',
      slug: 'original',
      updatedAt: { $date: '2026-10-24T00:00:00Z' },
      catalogSync: { lastSuccessfulEventId: 'event' },
    },
  ],
  categories: [{ _id: 'category', title: 'Категория', parent: null }],
  productVersions: [{ _id: 'version', parent: 'product', version: { title: 'Старо', price: 8 } }],
})

describe('offline BG/EN migration preparation', () => {
  it('round-trips text, null, empty values and historical versions without changing shared data', () => {
    const source = fixture()
    const plan = planLocalization(source)
    const migrated = rehearseLocalization(source, plan)
    expect(migrated.products[0].title).toEqual({ bg: 'Продукт' })
    expect(migrated.products[0].description).toEqual({ bg: '' })
    expect(migrated.products[0].shortDescription).toEqual({ bg: null })
    expect(migrated.productVersions[0].version).toEqual({ title: { bg: 'Старо' }, price: 8 })
    expect(rehearseLocalization(migrated, plan, true)).toEqual(source)
    expect(source.products[0].title).toBe('Продукт')
    for (const key of ['_id', 'price', 'stockQty', 'sku', 'slug', 'updatedAt', 'catalogSync'])
      expect(migrated.products[0][key]).toEqual(source.products[0][key])
    expect(planLocalization(migrated).patches).toEqual([])
  })
  it('preserves existing EN translations and absent fields', () => {
    const source = fixture()
    source.products[0].title = { bg: 'Име', en: 'Name' }
    delete source.products[0].meta
    const migrated = rehearseLocalization(source, planLocalization(source))
    expect(migrated.products[0].title).toEqual({ bg: 'Име', en: 'Name' })
    expect(migrated.products[0]).not.toHaveProperty('meta')
  })
  it.each([23, [], { en: 'orphan' }, { bg: 'Name', fr: 'Nom' }, { bg: 4 }])(
    'blocks malformed or unexpected text: %j',
    (value) => {
      const source = fixture()
      source.products[0].title = value
      expect(() => planLocalization(source)).toThrow('Unexpected localized value')
    },
  )
  it('refuses rollback after a translation or BG edit', () => {
    const source = fixture()
    const plan = planLocalization(source)
    for (const title of [{ bg: 'Продукт', en: 'Product' }, { bg: 'Променено' }]) {
      const migrated = rehearseLocalization(source, plan)
      migrated.products[0].title = title
      expect(() => rehearseLocalization(migrated, plan, true)).toThrow('Migration conflict')
    }
  })
  it('rejects stale input, duplicate IDs, unknown collections and unsafe patch paths', () => {
    const source = fixture()
    const plan = planLocalization(source)
    source.products[0].title = 'Changed'
    expect(() => rehearseLocalization(source, plan)).toThrow('Migration conflict')
    expect(() => planLocalization({ ...fixture(), orders: [] })).toThrow('Unsupported collection')
    const duplicate = fixture()
    duplicate.products.push(duplicate.products[0])
    expect(() => planLocalization(duplicate)).toThrow('Duplicate _id')
    plan.patches[0].path = '__proto__.value'
    expect(() => rehearseLocalization(fixture(), plan)).toThrow('Unsupported patch path')
  })
})
