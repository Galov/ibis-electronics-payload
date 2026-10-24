import { describe, expect, it } from 'vitest'
import {
  localizeProductFields,
  localProductLocalizationEnabled,
} from '@/i18n/localProductLocalization'
import type { Field } from 'payload'

describe('local product localization preview', () => {
  it('requires the exact isolated local database and preview flag', () => {
    expect(localProductLocalizationEnabled({})).toBe(false)
    const env = {
      IBIS_PRODUCT_LOCALIZATION_PREVIEW: 'true',
      IBIS_LOCAL_PREVIEW: 'true',
      DATABASE_URL: 'mongodb://127.0.0.1:27028/ibis_bg_en_test?directConnection=true',
    }
    expect(localProductLocalizationEnabled(env)).toBe(true)
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
