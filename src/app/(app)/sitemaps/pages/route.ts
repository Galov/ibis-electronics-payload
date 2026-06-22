import { NextResponse } from 'next/server'

import {
  buildSitemapXml,
  getPageSitemapEntries,
} from '@/utilities/sitemap'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

export async function GET() {
  const entries = await getPageSitemapEntries()
  const xml = buildSitemapXml(entries)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
