import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

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

  if (!nextURL.searchParams.has('add-to-cart')) {
    return NextResponse.next()
  }

  nextURL.searchParams.delete('add-to-cart')

  return NextResponse.redirect(nextURL, 301)
}

export const config = {
  matcher: ['/((?!_next|api|admin|ie-incompatible\\.html).*)'],
}
