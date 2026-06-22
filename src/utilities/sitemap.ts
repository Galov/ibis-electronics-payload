import configPromise from '@payload-config'
import { getPayload, type PaginatedDocs, type Where } from 'payload'

import { buildCategoryPath } from '@/utilities/category'
import { getBaseURL } from '@/utilities/getBaseURL'

export const SITEMAP_PRODUCT_CHUNK_SIZE = 5000
export const SITEMAP_REVALIDATE_SECONDS = 3600

const RESERVED_PAGE_SLUGS = new Set([
  'account',
  'blog',
  'brand',
  'cat',
  'checkout',
  'contact',
  'create-account',
  'find-order',
  'forgot-password',
  'kontakti',
  'login',
  'logout',
  'magazin',
  'partners',
  'privacy',
  'products',
  'produkt-etiket',
  'produkt-kategoriya',
  'recover-password',
  'shop',
  'terms',
])

type SitemapEntry = {
  lastModified?: string | undefined
  url: string
}

type ProductSitemapDoc = {
  slug?: null | string
  updatedAt?: null | string
}

type CategorySitemapDoc = {
  parent?: null | CategorySitemapDoc | string
  slug?: null | string
  updatedAt?: null | string
}

type PostSitemapDoc = {
  slug?: null | string
  updatedAt?: null | string
}

type PageSitemapDoc = {
  slug?: null | string
  updatedAt?: null | string
}

const baseURL = getBaseURL().replace(/\/$/, '')

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const normalizeLastModified = (value?: null | string) => {
  if (!value) return undefined

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString()
}

const toAbsoluteUrl = (path: string) => `${baseURL}${path.startsWith('/') ? path : `/${path}`}`

const getPayloadClient = async () => getPayload({ config: configPromise })

const fetchAllDocs = async <T>(args: {
  collection: 'categories' | 'pages' | 'posts'
  depth?: number
  limit?: number
  overrideAccess?: boolean
  select?: Record<string, true>
  sort?: string
  where?: Where
}): Promise<T[]> => {
  const payload = await getPayloadClient()
  const limit = args.limit ?? 5000
  const docs: T[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const result = (await payload.find({
      collection: args.collection,
      depth: args.depth ?? 0,
      limit,
      overrideAccess: args.overrideAccess ?? false,
      page,
      pagination: true,
      select: args.select,
      sort: args.sort,
      where: args.where,
    })) as PaginatedDocs<T>

    docs.push(...result.docs)
    totalPages = result.totalPages
    page += 1
  }

  return docs
}

export const buildSitemapXml = (entries: SitemapEntry[]) => {
  const body = entries
    .map(({ lastModified, url }) => {
      const parts = [`<loc>${xmlEscape(url)}</loc>`]

      if (lastModified) {
        parts.push(`<lastmod>${xmlEscape(lastModified)}</lastmod>`)
      }

      return `<url>${parts.join('')}</url>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
}

export const buildSitemapIndexXml = (entries: SitemapEntry[]) => {
  const body = entries
    .map(({ lastModified, url }) => {
      const parts = [`<loc>${xmlEscape(url)}</loc>`]

      if (lastModified) {
        parts.push(`<lastmod>${xmlEscape(lastModified)}</lastmod>`)
      }

      return `<sitemap>${parts.join('')}</sitemap>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`
}

export const getProductSitemapPageCount = async () => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'products',
    draft: false,
    limit: 1,
    overrideAccess: false,
    page: 1,
    pagination: true,
    select: {
      slug: true,
    },
    sort: 'id',
    where: {
      published: {
        equals: true,
      },
    },
  })

  return Math.max(1, Math.ceil(result.totalDocs / SITEMAP_PRODUCT_CHUNK_SIZE))
}

export const getProductSitemapEntries = async (page: number): Promise<SitemapEntry[]> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'products',
    draft: false,
    limit: SITEMAP_PRODUCT_CHUNK_SIZE,
    overrideAccess: false,
    page,
    pagination: true,
    select: {
      slug: true,
      updatedAt: true,
    },
    sort: 'id',
    where: {
      published: {
        equals: true,
      },
    },
  })

  return (result.docs as ProductSitemapDoc[])
    .filter((product) => Boolean(product.slug))
    .map((product) => ({
      lastModified: normalizeLastModified(product.updatedAt),
      url: toAbsoluteUrl(`/products/${product.slug}`),
    }))
}

export const getCategorySitemapEntries = async (): Promise<SitemapEntry[]> => {
  const docs = await fetchAllDocs<CategorySitemapDoc>({
    collection: 'categories',
    depth: 10,
    select: {
      parent: true,
      slug: true,
      updatedAt: true,
    },
    sort: 'id',
  })

  return docs
    .filter((category) => Boolean(category.slug))
    .map((category) => ({
      lastModified: normalizeLastModified(category.updatedAt),
      url: toAbsoluteUrl(buildCategoryPath(category)),
    }))
}

export const getPostSitemapEntries = async (): Promise<SitemapEntry[]> => {
  const docs = await fetchAllDocs<PostSitemapDoc>({
    collection: 'posts',
    select: {
      slug: true,
      updatedAt: true,
    },
    sort: 'id',
    where: {
      _status: {
        equals: 'published',
      },
    },
  })

  return docs
    .filter((post) => Boolean(post.slug))
    .map((post) => ({
      lastModified: normalizeLastModified(post.updatedAt),
      url: toAbsoluteUrl(`/blog/${post.slug}`),
    }))
}

export const getPageSitemapEntries = async (): Promise<SitemapEntry[]> => {
  const staticEntries: SitemapEntry[] = [
    '/',
    '/magazin',
    '/partners',
    '/blog',
    '/kontakti',
    '/terms',
    '/privacy',
  ].map((path) => ({
    url: toAbsoluteUrl(path),
  }))

  const docs = await fetchAllDocs<PageSitemapDoc>({
    collection: 'pages',
    select: {
      slug: true,
      updatedAt: true,
    },
    sort: 'id',
    where: {
      _status: {
        equals: 'published',
      },
    },
  })

  const pageEntries = docs
    .filter((page) => Boolean(page.slug) && !RESERVED_PAGE_SLUGS.has(String(page.slug)))
    .map((page) => ({
      lastModified: normalizeLastModified(page.updatedAt),
      url: toAbsoluteUrl(`/${page.slug}`),
    }))

  return [...staticEntries, ...pageEntries]
}

export const getSitemapIndexEntries = async (): Promise<SitemapEntry[]> => {
  const productPageCount = await getProductSitemapPageCount()
  const productEntries = Array.from({ length: productPageCount }, (_, index) => ({
    url: toAbsoluteUrl(`/sitemaps/products/${index + 1}`),
  }))

  return [
    ...productEntries,
    { url: toAbsoluteUrl('/sitemaps/categories') },
    { url: toAbsoluteUrl('/sitemaps/posts') },
    { url: toAbsoluteUrl('/sitemaps/pages') },
  ]
}
