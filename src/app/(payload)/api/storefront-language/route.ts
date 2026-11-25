import { NextRequest, NextResponse } from 'next/server'
import { queryProductBySlug } from '@/utilities/getProductByRoute'
import { productHref } from '@/i18n/productHref'
import { STOREFRONT_CHOICE_COOKIE, STOREFRONT_CHOICE_MAX_AGE } from '@/i18n/storefrontPreference'
import { getBaseURL } from '@/utilities/getBaseURL'

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale')
  const path = request.nextUrl.searchParams.get('path') || ''
  if (
    (locale !== 'bg' && locale !== 'en') ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\')
  )
    return NextResponse.json({ error: 'Invalid language route' }, { status: 400 })
  const origin = process.env.IBIS_LOCAL_PREVIEW === 'true' ? request.nextUrl.origin : getBaseURL()
  const current = new URL(path, origin)
  const match = current.pathname.match(/^\/(en\/)?products\/([^/]+)\/?$/)
  if (!match) return NextResponse.json({ error: 'Invalid product route' }, { status: 400 })
  const product = await queryProductBySlug({ slug: match[2], locale: match[1] ? 'en' : 'bg' })
  const target =
    product && (locale === 'bg' || product.englishSlug)
      ? productHref(product, locale)
      : locale === 'en'
        ? '/en'
        : '/magazin'
  const destination = new URL(target, origin)
  destination.search = current.search
  destination.hash = current.hash
  const response = NextResponse.redirect(destination, 307)
  response.headers.set('Cache-Control', 'private, no-store')
  response.cookies.set(STOREFRONT_CHOICE_COOKIE, locale, {
    path: '/',
    maxAge: STOREFRONT_CHOICE_MAX_AGE,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  })
  return response
}
