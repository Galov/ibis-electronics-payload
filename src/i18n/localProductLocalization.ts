import type { Field, Plugin } from 'payload'

export function localProductLocalizationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.IBIS_PRODUCT_LOCALIZATION_PREVIEW !== 'true') return false
  const uri = new URL(env.DATABASE_URL || 'invalid:')
  if (
    env.IBIS_LOCAL_PREVIEW !== 'true' ||
    uri.protocol !== 'mongodb:' ||
    uri.hostname !== '127.0.0.1' ||
    uri.port !== '27028' ||
    uri.pathname !== '/ibis_bg_en_test'
  ) {
    throw new Error('Product localization preview requires the isolated local test database')
  }
  return true
}

const productText = new Set([
  'title',
  'description',
  'shortDescription',
  'meta.title',
  'meta.description',
])

export function localizeProductFields(fields: Field[], product: boolean, parent = ''): Field[] {
  return fields.map((field) => {
    const path = 'name' in field ? [parent, field.name].filter(Boolean).join('.') : parent
    const next = { ...field }
    if ('localized' in field || (product && productText.has(path))) {
      Object.assign(next, { localized: product && productText.has(path) })
    }
    if ('fields' in next) next.fields = localizeProductFields(next.fields, product, path)
    if ('tabs' in next)
      next.tabs = next.tabs.map((tab) => ({
        ...tab,
        fields: localizeProductFields(
          tab.fields,
          product,
          'name' in tab ? [path, tab.name].filter(Boolean).join('.') : path,
        ),
      }))
    return next
  })
}

// This rehearsal switch cannot enable localization on a production database.
// Existing SEO plugin defaults localize images and other collections as well;
// restrict this preview to the five agreed product text fields.
export const localProductLocalizationPlugin: Plugin = (config) => {
  if (!localProductLocalizationEnabled()) return config
  return {
    ...config,
    localization: { locales: ['bg', 'en'], defaultLocale: 'bg', fallback: true },
    collections: config.collections?.map((collection) => ({
      ...collection,
      fields: localizeProductFields(collection.fields, collection.slug === 'products'),
    })),
    globals: config.globals?.map((global) => ({
      ...global,
      fields: localizeProductFields(global.fields, false),
    })),
  }
}
