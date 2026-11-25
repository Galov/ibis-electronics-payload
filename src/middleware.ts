import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { detectStorefront, isSearchOrPreviewAgent } from './i18n/storefrontDetection'
import { parseStorefrontChoice, STOREFRONT_CHOICE_COOKIE } from './i18n/storefrontPreference'
import { ROMANIAN_STOREFRONT } from './ecommerce/checkoutDestination'

const normalizeDuplicatedProductPath = (pathname: string) => {
  const match = pathname.match(/^\/products\/([^/]+)\/products\/([^/]+)\/?$/u)

  if (!match) return null

  if (match[1] !== match[2]) return null

  return `/products/${match[1]}`
}

const normalizeDuplicatedCategoryPath = (pathname: string) => {
  const match = pathname.match(/^\/cat\/(.+)\/cat\/(.+)\/?$/u)

  if (!match) return null

  if (match[1] !== match[2]) return null

  return `/cat/${match[1]}`
}

export function middleware(request: NextRequest) {
  const nextURL = request.nextUrl.clone()
  const normalizedProductPath = normalizeDuplicatedProductPath(nextURL.pathname)
  const normalizedCategoryPath = normalizeDuplicatedCategoryPath(nextURL.pathname)

  if (normalizedProductPath) {
    nextURL.pathname = normalizedProductPath
    return NextResponse.redirect(nextURL, 301)
  }

  if (normalizedCategoryPath) {
    nextURL.pathname = normalizedCategoryPath
    return NextResponse.redirect(nextURL, 301)
  }

  // Negotiate only the neutral entry URL. Explicit BG/EN pages stay intact.
  if (nextURL.pathname === '/' && ['GET', 'HEAD'].includes(request.method)) {
    const bot = isSearchOrPreviewAgent(request.headers.get('user-agent'))
    const choice = parseStorefrontChoice(request.cookies.get(STOREFRONT_CHOICE_COOKIE)?.value)
    const detected = detectStorefront(
      request.headers.get('cf-ipcountry'),
      request.headers.get('accept-language'),
    )
    const target = bot ? 'bg' : choice || (detected === 'ro' ? 'en' : detected)
    const destination = target === 'ro' ? new URL(ROMANIAN_STOREFRONT) : nextURL
    if (target !== 'ro') destination.pathname = target === 'en' ? '/en' : '/magazin'
    destination.searchParams.delete('add-to-cart')
    const response = NextResponse.redirect(destination, 307)
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Vary', 'Cookie, Accept-Language, CF-IPCountry, User-Agent')
    return response
  }

  if (!nextURL.searchParams.has('add-to-cart')) {
    return NextResponse.next()
  }

  nextURL.searchParams.delete('add-to-cart')

  return NextResponse.redirect(nextURL, 301)
}

export const config = {
  matcher: ['/((?!_next|api|admin|ie-incompatible\\.html).*)'],
}
