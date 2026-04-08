import type { Metadata } from 'next'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getSocialImageURL } from './getSocialImageURL'

type MetaImageLike =
  | {
      alt?: null | string
      url?: null | string
    }
  | null
  | string

type MetaLike = {
  description?: null | string
  image?: MetaImageLike
  title?: null | string
}

type DocLike = {
  meta?: MetaLike | null
  slug?: null | string | string[]
  title?: null | string
}

const normalizeString = (value?: null | string) => {
  const normalized = value?.trim()

  return normalized ? normalized : undefined
}

const buildAbsoluteUrl = (path?: null | string) => {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
  return `${serverUrl}${path.startsWith('/') ? path : `/${path}`}`
}

const normalizePath = (value?: null | string | string[]) => {
  if (!value) return undefined
  if (Array.isArray(value)) return `/${value.join('/')}`
  if (/^https?:\/\//i.test(value)) return value
  return value.startsWith('/') ? value : `/${value}`
}

const getMetaImage = (image?: MetaImageLike) => {
  if (!image || typeof image === 'string') return buildAbsoluteUrl(typeof image === 'string' ? image : undefined)
  return buildAbsoluteUrl(image.url)
}

export const generateMeta = async (args: {
  doc?: DocLike | null
  fallbackDescription?: string
  fallbackTitle?: string
  path?: string
}): Promise<Metadata> => {
  const { doc, fallbackDescription, fallbackTitle, path } = args || {}

  const title =
    normalizeString(doc?.meta?.title) ||
    normalizeString(doc?.title) ||
    normalizeString(fallbackTitle) ||
    'Ibis Electronics'
  const description =
    normalizeString(doc?.meta?.description) || normalizeString(fallbackDescription)
  const resolvedPath = path || normalizePath(doc?.slug) || '/'
  const canonical = buildAbsoluteUrl(resolvedPath)
  const ogImage = getMetaImage(doc?.meta?.image)
  const socialImage = ogImage || getSocialImageURL('/ibis_blue_logo.png')

  return {
    ...(canonical
      ? {
          alternates: {
            canonical,
          },
        }
      : {}),
    ...(description ? { description } : {}),
    metadataBase: canonical ? new URL(canonical) : undefined,
    openGraph: mergeOpenGraph({
      ...(description ? { description } : {}),
      ...(socialImage
        ? {
            images: [
              {
                url: socialImage,
              },
            ],
          }
        : {}),
      title,
      url: resolvedPath,
    }),
    twitter: {
      card: 'summary_large_image',
      ...(description ? { description } : {}),
      images: socialImage ? [socialImage] : undefined,
      title,
    },
    title,
  }
}
