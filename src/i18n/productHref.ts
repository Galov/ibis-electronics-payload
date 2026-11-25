import { localizeHref, type Locale } from './config'

export function productHref(
  product: { slug?: string | null; englishSlug?: string | null },
  locale: Locale,
) {
  const slug = locale === 'en' ? product.englishSlug || product.slug : product.slug
  return slug
    ? localizeHref(`/products/${encodeURIComponent(slug)}`, locale)
    : localizeHref('/magazin', locale)
}

export function productLanguageSwitchHref(href: string, locale: Locale) {
  const path = href.split(/[?#]/)[0]
  if (!/^\/(?:en\/)?products\/[^/]+\/?$/.test(path)) return null
  return `/api/storefront-language?locale=${locale}&path=${encodeURIComponent(href)}`
}
