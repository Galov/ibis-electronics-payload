import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import type { Locale } from '@/i18n/config'

type Global = keyof Config['globals']

async function getGlobal<T extends Global>(slug: T, depth = 0, locale: Locale = 'bg') {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
    locale,
    ...(slug === 'shopPage' ? { fallbackLocale: false as const } : {}),
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0, locale: Locale = 'bg') =>
  unstable_cache(async () => getGlobal<T>(slug, depth, locale), [slug, String(depth), locale], {
    tags: [`global_${slug}`],
  })
