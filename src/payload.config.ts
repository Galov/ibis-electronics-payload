import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { resendAdapter } from '@payloadcms/email-resend'
import { bg as payloadBg } from '@payloadcms/translations/languages/bg'
import { bg as ecommerceBg } from '@payloadcms/plugin-ecommerce/translations/languages/bg'

import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Brands } from '@/collections/Brands'
import { Categories } from '@/collections/Categories'
import { ContactInquiries } from '@/collections/ContactInquiries'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { Partners } from '@/collections/Partners'
import { Users } from '@/collections/Users'
import { nikPriceSyncHandler } from '@/endpoints/nik-price-sync'
import { recalculateRetailPricesHandler } from '@/endpoints/recalculateRetailPrices'
import { econtOfficesHandler } from '@/endpoints/econt-offices'
import { speedyOfficesHandler } from '@/endpoints/speedy-offices'
import { fullLexicalEditor } from '@/fields/fullLexicalEditor'
import { ContactPage } from '@/globals/ContactPage'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { OrderSettings } from '@/globals/OrderSettings'
import { PricingSettings } from '@/globals/PricingSettings'
import { PrivacyPage } from '@/globals/PrivacyPage'
import { ShopPage } from '@/globals/ShopPage'
import { TermsPage } from '@/globals/TermsPage'
import { pluginSeoBg } from '@/i18n/pluginSeoBg'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const resendApiKey = process.env.RESEND_API_KEY || ''
const defaultFromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@ibis-electronics.com'
const defaultFromName = process.env.EMAIL_FROM_NAME || 'Ibis Electronics'

export default buildConfig({
  admin: {
    components: {
      graphics: {
        Icon: {
          exportName: 'AdminIcon',
          path: '@/components/Logo/AdminIcon',
        },
        Logo: {
          exportName: 'AdminLogo',
          path: '@/components/Logo/AdminLogo',
        },
      },
    },
    dateFormat: 'dd.MM.yyyy, HH:mm',
    user: Users.slug,
  },
  collections: [Users, Brands, Categories, Pages, Partners, ContactInquiries, Media],
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || '',
  }),
  editor: fullLexicalEditor(),
  ...(resendApiKey
    ? {
        email: resendAdapter({
          apiKey: resendApiKey,
          defaultFromAddress,
          defaultFromName,
        }),
      }
    : {}),
  i18n: {
    fallbackLanguage: 'bg',
    supportedLanguages: {
      bg: {
        ...payloadBg,
        translations: {
          ...payloadBg.translations,
          ...ecommerceBg.translations,
          ...pluginSeoBg,
          general: {
            ...payloadBg.translations.general,
            noResults: 'Няма намерени {{label}}. {{label}} не съществуват или не отговарят на зададените филтри.',
          },
        },
      },
    },
  },
  endpoints: [
    {
      handler: recalculateRetailPricesHandler,
      method: 'post',
      path: '/pricing/recalculate',
    },
    {
      handler: econtOfficesHandler,
      method: 'get',
      path: '/integrations/econt/offices',
    },
    {
      handler: speedyOfficesHandler,
      method: 'get',
      path: '/integrations/speedy/offices',
    },
    {
      handler: nikPriceSyncHandler,
      method: 'post',
      path: '/integrations/nik/products/price-sync',
    },
  ],
  globals: [Header, Footer, TermsPage, PrivacyPage, ContactPage, ShopPage, PricingSettings, OrderSettings],
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Sharp is now an optional dependency -
  // if you want to resize images, crop, set focal point, etc.
  // make sure to install it and pass it to the config.
  // sharp,
})
