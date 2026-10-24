export const locales = ['bg', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'bg'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && locales.some((locale) => locale === value)

export const getPathLocale = (pathname: string): Locale =>
  pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'bg'

export const stripLocale = (pathname: string): string => {
  if (getPathLocale(pathname) !== 'en') return pathname
  return pathname.slice(3) || '/'
}

/** Only local page paths are localized. Assets, API URLs and external links stay intact. */
export const localizeHref = (href: string, locale: Locale): string => {
  if (locale === 'en' && /^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href)
      const configuredOrigin = new URL(
        process.env.NEXT_PUBLIC_SERVER_URL || 'https://ibis-electronics.com',
      ).origin
      const sameSite =
        url.origin === configuredOrigin ||
        ['https://ibis-electronics.com', 'https://www.ibis-electronics.com'].includes(url.origin)
      const nonPage =
        /^\/(?:api|admin|_next)(?:\/|$)/.test(url.pathname) ||
        (!hasEnglishRoute(url.pathname) && /\.[^/]+$/.test(url.pathname))
      if (sameSite && !nonPage)
        return localizeHref(`${url.pathname}${url.search}${url.hash}`, locale)
    } catch {
      return href
    }
  }
  if (!href.startsWith('/') || href.startsWith('//')) return href
  const boundary = href.search(/[?#]/)
  const pathname = boundary === -1 ? href : href.slice(0, boundary)
  const suffix = boundary === -1 ? '' : href.slice(boundary)
  const unprefixed = stripLocale(pathname)
  const path =
    locale === 'en'
      ? ({ '/contact': '/kontakti', '/shop': '/magazin' } as Record<string, string>)[unprefixed] ||
        unprefixed
      : unprefixed
  if (/^\/(?:api|admin|_next)(?:\/|$)/.test(path)) return href
  if (!hasEnglishRoute(path) && /\.[^/]+$/.test(path)) return href
  return `${locale === 'en' ? `/en${path === '/' ? '' : path}` : path}${suffix}`
}

/** Routes whose English counterparts are implemented in the first infrastructure stage. */
export const hasEnglishRoute = (pathname: string): boolean => {
  const path = stripLocale(pathname)
  return (
    path === '/' ||
    path === '/magazin' ||
    [
      'kategorii',
      'checkout',
      'checkout/confirm-order',
      'account',
      'account/addresses',
      'orders',
      'login',
      'logout',
      'create-account',
      'forgot-password',
      'recover-password',
      'find-order',
      'otkaz-porachka',
      'kontakti',
      'privacy',
      'terms',
      'za-nas',
      'uslugi',
      'serviz',
    ].some((route) => path === `/${route}`) ||
    /^\/orders\/[^/]+\/?$/.test(path) ||
    /^\/products\/[^/]+\/?$/.test(path) ||
    /^\/cat\/[^/]+(?:\/[^/]+)*\/?$/.test(path)
  )
}

/** An authentication return target must remain on this storefront. */
export function safeReturnHref(
  href: string | null | undefined,
  locale: Locale,
  fallback = '/account',
): string {
  if (!href || !href.startsWith('/') || href.startsWith('//') || href.includes('\\'))
    return localizeHref(fallback, locale)
  return localizeHref(href, locale)
}
