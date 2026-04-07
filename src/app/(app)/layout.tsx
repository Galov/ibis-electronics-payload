import type { ReactNode } from 'react'
import type { Metadata } from 'next'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import configPromise from '@payload-config'
import { GeistSans } from 'geist/font/sans'
import { getPayload } from 'payload'
import React from 'react'
import { getBaseURL } from '@/utilities/getBaseURL'
import { getSocialImageURL } from '@/utilities/getSocialImageURL'
import { buildOrganizationSchema } from '@/utilities/schema'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  openGraph: {
    images: [
      {
        url: getSocialImageURL('/logo.png'),
      },
    ],
    locale: 'bg_BG',
    siteName: 'Ibis Electronics',
    type: 'website',
  },
  title: {
    default: 'Ibis Electronics',
    template: '%s | Ibis Electronics',
  },
  twitter: {
    card: 'summary_large_image',
    images: [getSocialImageURL('/logo.png')],
  },
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const payload = await getPayload({ config: configPromise })
  const contactPage = await payload.findGlobal({
    slug: 'contact-page' as never,
    depth: 0,
  })
  const organizationJsonLd = buildOrganizationSchema(contactPage as never)

  return (
    <html className={[GeistSans.variable].filter(Boolean).join(' ')} lang="bg" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link href="/logo-sign.png" rel="icon" sizes="32x32" type="image/png" />
        <link href="/logo-sign.png" rel="apple-touch-icon" />
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
          type="application/ld+json"
        />
      </head>
      <body className="min-h-screen">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AdminBar />
            <LivePreviewListener />

            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
