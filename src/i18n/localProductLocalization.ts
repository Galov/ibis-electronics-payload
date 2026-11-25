import type { Field, Plugin } from 'payload'
import { preserveProductLocaleInput, preserveOtherProductLocale } from './preserveProductLocales'

export const localEnglishDatabaseNames = ['ibis_bg_en_test', 'ibis_en_release_rehearsal'] as const

// Separate release switch: the existing preview guard remains strictly local.
// Set only after the product/history migration, in both build and runtime environments.
export function productLocalizationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.IBIS_PRODUCT_LOCALIZATION_ENABLED !== 'true')
    return localProductLocalizationEnabled(env)
  if (
    env.IBIS_PRODUCT_LOCALIZATION_SCHEMA !== 'bg-en-v1' ||
    env.IBIS_LOCAL_PREVIEW === 'true' ||
    env.IBIS_PRODUCT_LOCALIZATION_PREVIEW === 'true' ||
    env.IBIS_EN_RELEASE_REHEARSAL === 'true'
  )
    throw new Error('Product localization release requires migrated bg-en-v1 schema without preview flags')
  return true
}

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
    !localEnglishDatabaseNames.some((name) => uri.pathname === `/${name}`)
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
    if (product && productText.has(path)) {
      const hooks = 'hooks' in field ? field.hooks : undefined
      Object.assign(next, { hooks: { ...hooks, beforeChange: [preserveOtherProductLocale, ...(hooks?.beforeChange || [])] } })
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

// Existing SEO plugin defaults localize images and other collections as well;
// restrict localization to the five agreed product text fields.
export const localProductLocalizationPlugin: Plugin = (config) => {
  if (!productLocalizationEnabled()) return config
  return {
    ...config,
    localization: {
      locales: [{ code: 'bg', label: 'Български' }, { code: 'en', label: 'English' }],
      defaultLocale: 'bg', fallback: true,
    },
    collections: config.collections?.map((collection) => ({
      ...collection,
      ...(collection.slug === 'products' ? { hooks: {
        ...collection.hooks,
        beforeValidate: [preserveProductLocaleInput, ...(collection.hooks?.beforeValidate || [])],
      } } : {}),
      fields: localizeProductFields(collection.fields, collection.slug === 'products'),
    })),
    globals: config.globals?.map((global) => ({
      ...global,
      fields: localizeProductFields(global.fields, false),
    })),
  }
}
