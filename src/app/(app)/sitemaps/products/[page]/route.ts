import { NextResponse } from 'next/server'

import {
  buildSitemapXml,
  getProductSitemapEntries,
  getProductSitemapPageCount,
} from '@/utilities/sitemap'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params
  const pageNumber = Number(page)

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const totalPages = await getProductSitemapPageCount()

  if (pageNumber > totalPages) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const entries = await getProductSitemapEntries(pageNumber)
  const xml = buildSitemapXml(entries)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
