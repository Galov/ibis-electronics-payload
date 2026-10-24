import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import StorefrontLayout from '@/components/layout/StorefrontLayout'
import { metadata as storefrontMetadata } from '@/components/layout/StorefrontLayout'

export const dynamic = 'force-dynamic'

// Translation readiness is a separate release gate. Do not index Bulgarian fallback content.
export const metadata: Metadata = {
  ...storefrontMetadata,
  referrer: 'no-referrer',
  openGraph: { ...storefrontMetadata.openGraph, locale: 'en_GB' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <StorefrontLayout locale="en">{children}</StorefrontLayout>
}
