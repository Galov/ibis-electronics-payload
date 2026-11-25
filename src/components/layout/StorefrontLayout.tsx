/* eslint-disable @next/next/no-head-element, @next/next/no-before-interactive-script-outside-document -- Shared App Router root layout for the two language roots. */
import type { ReactNode } from 'react'
import type { Locale } from '@/i18n/config'
import { LocaleProvider } from '@/i18n/provider'
import type { Metadata } from 'next'

import { AdminBar } from '@/components/AdminBar'
import { CookieConsentBanner } from '@/components/CookieConsent/Banner'
import { COOKIE_CONSENT_STORAGE_KEY } from '@/components/CookieConsent/shared'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { Providers } from '@/providers'
import configPromise from '@payload-config'
import { GeistSans } from 'geist/font/sans'
import { getPayload } from 'payload'
import React from 'react'
import { getBaseURL } from '@/utilities/getBaseURL'
import { getSocialImageURL } from '@/utilities/getSocialImageURL'
import { buildOrganizationSchema } from '@/utilities/schema'
import Script from 'next/script'
import '@/app/(app)/globals.css'
import { cookies, headers } from 'next/headers'
import { RomanianStoreSuggestion } from '@/components/RomanianStoreSuggestion'
import { shouldOfferRomanianStore } from '@/i18n/storefrontDetection'
import { STOREFRONT_CHOICE_COOKIE } from '@/i18n/storefrontPreference'

export const dynamic = 'force-dynamic'

const gtmID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || ''

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  openGraph: {
    images: [
      {
        url: getSocialImageURL('/ibis_blue_logo.png'),
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
    images: [getSocialImageURL('/ibis_blue_logo.png')],
  },
}

export default async function RootLayout({
  children,
  locale = 'bg',
}: {
  children: ReactNode
  locale?: Locale
}) {
  const payload = await getPayload({ config: configPromise })
  const contactPage = await payload.findGlobal({
    slug: 'contact-page' as never,
    depth: 0,
  })
  const organizationJsonLd = buildOrganizationSchema(contactPage as never)
  const showRomanianSuggestion = shouldOfferRomanianStore(
    await headers(),
    (await cookies()).get(STOREFRONT_CHOICE_COOKIE)?.value,
  )

  return (
    <html
      className={[GeistSans.variable].filter(Boolean).join(' ')}
      data-theme="light"
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <link href="/logo-sign.png" rel="icon" sizes="32x32" type="image/png" />
        <link href="/logo-sign.png" rel="apple-touch-icon" />
        {gtmID ? (
          <Script id="google-consent-mode" strategy="beforeInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = window.gtag || gtag;

            (function () {
              var storedChoice = null;

              try {
                storedChoice = window.localStorage.getItem('${COOKIE_CONSENT_STORAGE_KEY}');
              } catch (error) {
                storedChoice = null;
              }

              var analyticsState = storedChoice === 'accepted' ? 'granted' : 'denied';

              gtag('consent', 'default', {
                ad_personalization: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                analytics_storage: analyticsState,
                wait_for_update: 500
              });
            })();
          `}</Script>
        ) : null}
        {gtmID ? (
          <Script id="google-tag-manager" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmID}');
          `}</Script>
        ) : null}
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
          type="application/ld+json"
        />
      </head>
      <body className="min-h-screen">
        {gtmID ? (
          <noscript>
            <iframe
              height="0"
              src={`https://www.googletagmanager.com/ns.html?id=${gtmID}`}
              style={{ display: 'none', visibility: 'hidden' }}
              width="0"
            />
          </noscript>
        ) : null}
        <LocaleProvider locale={locale}>
          <Providers>
            <div className="flex min-h-screen flex-col">
              <AdminBar />
              <LivePreviewListener />

              <Header locale={locale} />
              <RomanianStoreSuggestion eligible={showRomanianSuggestion} />
              <main className="flex-1">{children}</main>
              <Footer locale={locale} />
              <CookieConsentBanner analyticsEnabled={Boolean(gtmID)} />
            </div>
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  )
}
