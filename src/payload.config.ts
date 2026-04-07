import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { bg as payloadBg } from '@payloadcms/translations/languages/bg'
import { bg as ecommerceBg } from '@payloadcms/plugin-ecommerce/translations/languages/bg'

import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
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
import { recalculateRetailPricesHandler } from '@/endpoints/recalculateRetailPrices'
import { speedyOfficesHandler } from '@/endpoints/speedy-offices'
import { ContactPage } from '@/globals/ContactPage'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { PricingSettings } from '@/globals/PricingSettings'
import { PrivacyPage } from '@/globals/PrivacyPage'
import { ShopPage } from '@/globals/ShopPage'
import { TermsPage } from '@/globals/TermsPage'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
    user: Users.slug,
  },
  collections: [Users, Brands, Categories, Pages, Partners, ContactInquiries, Media],
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || '',
  }),
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['products', 'categories', 'brands'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })

            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: ({ linkType }) => linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  i18n: {
    fallbackLanguage: 'bg',
    supportedLanguages: {
      bg: {
        ...payloadBg,
        translations: {
          ...payloadBg.translations,
          ...ecommerceBg.translations,
          general: {
            ...payloadBg.translations.general,
            noResults: 'Няма намерени {{label}}. {{label}} не съществуват или не отговарят на зададените филтри.',
          },
        },
      },
    },
  },
  //email: nodemailerAdapter(),
  endpoints: [
    {
      handler: recalculateRetailPricesHandler,
      method: 'post',
      path: '/pricing/recalculate',
    },
    {
      handler: speedyOfficesHandler,
      method: 'get',
      path: '/integrations/speedy/offices',
    },
  ],
  globals: [Header, Footer, TermsPage, PrivacyPage, ContactPage, ShopPage, PricingSettings],
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
