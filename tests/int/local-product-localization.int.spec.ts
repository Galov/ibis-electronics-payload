import { describe, expect, it } from 'vitest'
import {
  localizeProductFields,
  localProductLocalizationEnabled,
  productLocalizationEnabled,
} from '@/i18n/localProductLocalization'
import type { Field } from 'payload'

describe('local product localization preview', () => {
  it('keeps the release off by default and requires explicit migrated schema confirmation', () => {
    expect(productLocalizationEnabled({})).toBe(false)
    const release = { IBIS_PRODUCT_LOCALIZATION_ENABLED: 'true', IBIS_PRODUCT_LOCALIZATION_SCHEMA: 'bg-en-v1' }
    expect(productLocalizationEnabled(release)).toBe(true)
    expect(() => productLocalizationEnabled({ ...release, IBIS_PRODUCT_LOCALIZATION_SCHEMA: '' })).toThrow('migrated')
    for (const key of ['IBIS_LOCAL_PREVIEW', 'IBIS_PRODUCT_LOCALIZATION_PREVIEW', 'IBIS_EN_RELEASE_REHEARSAL'])
      expect(() => productLocalizationEnabled({ ...release, [key]: 'true' })).toThrow('without preview')
    expect(() => localProductLocalizationEnabled({
      ...release, IBIS_PRODUCT_LOCALIZATION_PREVIEW: 'true', DATABASE_URL: 'mongodb://remote/live',
    })).toThrow('isolated local')
  })
  it('requires the exact isolated local database and preview flag', () => {
    expect(localProductLocalizationEnabled({})).toBe(false)
    const env = {
      IBIS_PRODUCT_LOCALIZATION_PREVIEW: 'true',
      IBIS_LOCAL_PREVIEW: 'true',
      DATABASE_URL: 'mongodb://127.0.0.1:27028/ibis_bg_en_test?directConnection=true',
    }
    expect(localProductLocalizationEnabled(env)).toBe(true)
    expect(
      localProductLocalizationEnabled({
        ...env,
        DATABASE_URL: 'mongodb://127.0.0.1:27028/ibis_en_release_rehearsal?directConnection=true',
      }),
    ).toBe(true)
    for (const DATABASE_URL of [
      'mongodb://remote:27028/ibis_bg_en_test',
      'mongodb://127.0.0.1:27028/real',
      'mongodb://127.0.0.1:27017/ibis_bg_en_test',
    ])
      expect(() => localProductLocalizationEnabled({ ...env, DATABASE_URL })).toThrow(
        'isolated local',
      )
    expect(() => localProductLocalizationEnabled({ ...env, IBIS_LOCAL_PREVIEW: 'false' })).toThrow(
      'isolated local',
    )
  })
  it('localizes product text while keeping SEO images and unrelated collections shared', () => {
    const fields: Field[] = [
      { name: 'title', type: 'text' },
      { name: 'price', type: 'number' },
      {
        type: 'tabs',
        tabs: [{ label: 'Content', fields: [{ name: 'description', type: 'textarea' }] }],
      },
      {
        name: 'meta',
        type: 'group',
        fields: [
          { name: 'title', type: 'text', localized: true },
          { name: 'image', type: 'upload', relationTo: 'media', localized: true },
        ],
      },
    ]
    const result = localizeProductFields(fields, true)
    expect(result[0]).toMatchObject({ localized: true })
    expect(result[1]).not.toHaveProperty('localized')
    expect(result[2]).toMatchObject({ tabs: [{ fields: [{ localized: true }] }] })
    expect(result[3]).toMatchObject({
      fields: [
        { name: 'title', localized: true },
        { name: 'image', localized: false },
      ],
    })
    expect(localizeProductFields(fields, false)[3]).toMatchObject({
      fields: [{ localized: false }, { localized: false }],
    })
    expect(fields[3]).toMatchObject({ fields: [{ localized: true }, { localized: true }] })
  })
})
