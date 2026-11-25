import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Locale } from '@/i18n/config'
import { localProductLocalizationEnabled } from '@/i18n/localProductLocalization'
import { decodeMangledLegacySlug } from '@/utilities/legacySlugs'

export const decodeRouteSlug = (slug: string) => {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

export const queryProductBySlug = async ({
  slug,
  locale = 'bg',
}: {
  slug: string
  locale?: Locale
}) => {
  const payload = await getPayload({ config: configPromise })
  const routeSlug = decodeRouteSlug(slug)
  const decodedSlug = decodeMangledLegacySlug(routeSlug)
  const slugs = Array.from(new Set([slug, routeSlug, decodedSlug].filter(Boolean))) as string[]

  const fields = locale === 'en' ? ['englishSlug', 'englishLegacySlug', 'slug'] : ['slug']
  for (const field of fields) {
    const result = await payload.find({
      collection: 'products',
      locale,
      fallbackLocale: locale === 'en' ? false : 'bg',
      depth: 2,
      draft: false,
      limit: 1,
      overrideAccess: false,
      pagination: false,
      where: {
        and: [
          ...(locale === 'en' ? [{ title: { exists: true } }, { title: { not_equals: '' } }] : []),
          {
            [field]: {
              in: slugs,
            },
          },
          {
            published: {
              equals: true,
            },
          },
        ],
      },
    })

    if (result.docs?.[0]) return result.docs[0]
  }

  // Only the three explicitly selected local translation examples may bypass
  // public visibility for review. Stock and the normal catalog access stay intact.
  if (locale === 'en' && localProductLocalizationEnabled()) {
    const preview = await payload.find({
      collection: 'products',
      locale: 'en',
      fallbackLocale: locale === 'en' ? false : 'bg',
      depth: 2,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: {
        and: [
          ...(locale === 'en' ? [{ title: { exists: true } }, { title: { not_equals: '' } }] : []),
          { or: fields.map((field) => ({ [field]: { in: slugs } })) },
          { published: { equals: true } },
          { sku: { in: ['126ZN07OR', '167AR06', '219FR05'] } },
        ],
      },
    })
    return preview.docs[0] || null
  }
  return null
}
