import { NextResponse } from 'next/server'

import {
  SITEMAP_REVALIDATE_SECONDS,
  buildSitemapXml,
  getPostSitemapEntries,
} from '@/utilities/sitemap'

export const revalidate = SITEMAP_REVALIDATE_SECONDS

export async function GET() {
  const entries = await getPostSitemapEntries()
  const xml = buildSitemapXml(entries)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
