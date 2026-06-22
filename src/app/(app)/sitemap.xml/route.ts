import { NextResponse } from 'next/server'

import {
  buildSitemapIndexXml,
  getSitemapIndexEntries,
} from '@/utilities/sitemap'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

export async function GET() {
  const entries = await getSitemapIndexEntries()
  const xml = buildSitemapIndexXml(entries)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
