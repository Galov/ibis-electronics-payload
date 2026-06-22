import { NextResponse } from 'next/server'

import {
  SITEMAP_REVALIDATE_SECONDS,
  buildSitemapIndexXml,
  getSitemapIndexEntries,
} from '@/utilities/sitemap'

export const revalidate = SITEMAP_REVALIDATE_SECONDS

export async function GET() {
  const entries = await getSitemapIndexEntries()
  const xml = buildSitemapIndexXml(entries)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
