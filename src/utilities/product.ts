import type { Product } from '@/payload-types'

import { formatLegacyProductDescription } from '@/utilities/formatLegacyProductDescription'

const publicStorageBase = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || ''

const clampText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value

  return `${value.slice(0, maxLength).trimEnd()}...`
}

export const getProductImageAlt = ({
  mediaAlt,
  imageAlt,
  index = 0,
  productTitle,
}: {
  mediaAlt?: null | string
  imageAlt?: null | string
  index?: number
  productTitle?: null | string
}) => {
  if (imageAlt?.trim()) {
    return imageAlt.trim()
  }

  if (mediaAlt?.trim()) {
    return mediaAlt.trim()
  }

  if (productTitle?.trim()) {
    return index > 0
      ? `${productTitle.trim()} - изображение ${index + 1}`
      : productTitle.trim()
  }

  return ''
}

export const getProductSEODescription = (product?: Partial<Product> | null) => {
  const normalizedDescription = formatLegacyProductDescription(
    product?.shortDescription || product?.description,
  )

  if (normalizedDescription) {
    return clampText(normalizedDescription, 180)
  }

  const brand = product?.brand && typeof product.brand !== 'string' ? product.brand.title : null
  const primaryCategory =
    product?.categories?.find(
      (category): category is Exclude<NonNullable<Product['categories']>[number], string> =>
        Boolean(category && typeof category !== 'string' && category.title),
    ) || null

  const metaParts = [
    product?.title?.trim(),
    brand?.trim() || null,
    primaryCategory?.title?.trim() || null,
    product?.sku?.trim() ? `Код ${product.sku.trim()}` : null,
  ].filter(Boolean)

  if (metaParts.length > 0) {
    return clampText(`${metaParts.join(' · ')} в каталога на Ibis Electronics.`, 180)
  }

  return 'Разгледайте продукта в каталога на Ibis Electronics.'
}

export const resolveProductImageURL = (image?: {
  image?: { url?: null | string } | null | string
  legacyUrl?: null | string
  storageKey?: null | string
}) => {
  if (image?.image && typeof image.image !== 'string' && image.image.url) {
    return image.image.url
  }

  if (image?.storageKey && publicStorageBase) {
    return `${publicStorageBase.replace(/\/$/, '')}/${image.storageKey.replace(/^\//, '')}`
  }

  return image?.legacyUrl || ''
}

export const getProductPrimaryImage = (product?: Partial<Product> | null) => {
  const image = product?.images?.[0]

  if (!image) {
    return null
  }

  return {
    alt: getProductImageAlt({
      mediaAlt:
        image.image && typeof image.image !== 'string' ? (image.image.alt ?? null) : null,
      imageAlt: image.alt,
      productTitle: product?.title,
    }),
    url: resolveProductImageURL(image),
  }
}

export const isVisibleProduct = (product?: Partial<Product> | null) => {
  return Boolean(product?.published)
}
