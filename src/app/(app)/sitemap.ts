import type { MetadataRoute } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { buildCategoryPath } from '@/utilities/category'
import { getBaseURL } from '@/utilities/getBaseURL'

export const dynamic = 'force-dynamic'

type SitemapCategory = {
  parent?: null | SitemapCategory | string
  slug?: null | string
  updatedAt?: null | string
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config: configPromise })
  const baseURL = getBaseURL()

  const [products, categories] = await Promise.all([
    payload.find({
      collection: 'products',
      depth: 0,
      draft: false,
      limit: 1000,
      overrideAccess: false,
      pagination: false,
      select: {
        slug: true,
        updatedAt: true,
        published: true,
      },
      where: {
        published: {
          equals: true,
        },
      },
    }),
    payload.find({
      collection: 'categories',
      depth: 10,
      limit: 1000,
      pagination: false,
      select: {
        parent: true,
        slug: true,
        updatedAt: true,
      },
    }),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/shop',
    '/partners',
    '/contact',
    '/terms',
    '/privacy',
  ].map((path) => ({
    changeFrequency: path === '' ? 'daily' : 'weekly',
    lastModified: new Date(),
    priority: path === '' ? 1 : path === '/shop' ? 0.95 : 0.7,
    url: `${baseURL}${path || '/'}`,
  }))

  const productRoutes: MetadataRoute.Sitemap = products.docs
    .filter((product) => Boolean(product.slug))
    .map((product) => ({
      changeFrequency: 'weekly' as const,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
      priority: 0.8,
      url: `${baseURL}/products/${product.slug}`,
    }))

  const categoryRoutes: MetadataRoute.Sitemap = (categories.docs as SitemapCategory[])
    .filter((category) => Boolean(category.slug))
    .map((category) => ({
      changeFrequency: 'weekly' as const,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : new Date(),
      priority: 0.75,
      url: `${baseURL}${buildCategoryPath(category)}`,
    }))

  return [...staticRoutes, ...categoryRoutes, ...productRoutes]
}
