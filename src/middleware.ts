import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const nextURL = request.nextUrl.clone()

  if (!nextURL.searchParams.has('add-to-cart')) {
    return NextResponse.next()
  }

  nextURL.searchParams.delete('add-to-cart')

  return NextResponse.redirect(nextURL, 301)
}

export const config = {
  matcher: ['/((?!_next|api|admin|ie-incompatible\\.html).*)'],
}
