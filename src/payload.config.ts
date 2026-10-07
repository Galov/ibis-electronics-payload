import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { resendAdapter } from '@payloadcms/email-resend'
import { bg as payloadBg } from '@payloadcms/translations/languages/bg'
import { bg as ecommerceBg } from '@payloadcms/plugin-ecommerce/translations/languages/bg'

import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Brands } from '@/collections/Brands'
import { MerchantSyncEntries } from '@/collections/MerchantSyncEntries'
import { merchantProductTask, merchantReconcileTask } from '@/merchant/tasks'
import { queueMerchantReconciliation } from '@/merchant/endpoint'
import { checkRole } from '@/access/utilities'
import { ArticleSyncOutgoing } from '@/collections/ArticleSyncOutgoing'
import { refreshArticle, sendArticle } from '@/articleSync/endpoints'
import { CatalogSyncBatchRuns } from '@/collections/CatalogSyncBatchRuns'
import { RomaniaUpdateStreams } from '@/collections/RomaniaUpdateStreams'
import { Categories } from '@/collections/Categories'
import { ContactInquiries } from '@/collections/ContactInquiries'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { PostCategories } from '@/collections/PostCategories'
import { Posts } from '@/collections/Posts'
import { Partners } from '@/collections/Partners'
import { ProductReviewItems } from '@/collections/ProductReviewItems'
import { boxNowLockersHandler } from '@/endpoints/boxnow-lockers'
import {
  boxNowCreateShipmentHandler,
  boxNowParcelLabelHandler,
} from '@/endpoints/boxnow-order-shipment'
import { Users } from '@/collections/Users'
import { nikPriceSyncHandler } from '@/endpoints/nik-price-sync'
import { markProductReviewedHandler } from '@/endpoints/markProductReviewed'
import {
  catalogSyncAdminSendHandler,
  catalogSyncAdminStatusHandler,
} from '@/endpoints/catalogSyncAdmin'
import { ordersReportHandler } from '@/endpoints/orders-report'
import { nikOrderRetry } from '@/endpoints/nik-order-retry'
import {
  productVersionsAuditHandler,
  productVersionsRepairHandler,
} from '@/endpoints/productVersionsAudit'
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
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const resendApiKey = process.env.RESEND_API_KEY || ''
const defaultFromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@ibis-electronics.com'
const defaultFromName = process.env.EMAIL_FROM_NAME || 'Ibis Electronics'

export default buildConfig({
  admin: {
    components: {
      beforeDashboard: ['@/components/BeforeDashboard'],
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
  collections: [
    Users,
    ArticleSyncOutgoing,
    Brands,
    Categories,
    Pages,
    PostCategories,
    Posts,
    Partners,
    ContactInquiries,
    Media,
    ProductReviewItems,
    CatalogSyncBatchRuns,
    RomaniaUpdateStreams,
    MerchantSyncEntries,
  ],
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
          general: {
            ...payloadBg.translations.general,
            noResults:
              'Няма намерени {{label}}. {{label}} не съществуват или не отговарят на зададените филтри.',
          },
        },
      },
    },
  },
  endpoints: [
    {
      path: '/integrations/merchant/reconcile',
      method: 'post',
      handler: queueMerchantReconciliation,
    },
    { path: '/article-sync/posts/:id/send', method: 'post', handler: sendArticle },
    { path: '/article-sync/posts/:id/status', method: 'get', handler: refreshArticle },
    { path: '/nik-orders/:id/retry', method: 'post', handler: nikOrderRetry },
    {
      handler: recalculateRetailPricesHandler,
      method: 'post',
      path: '/pricing/recalculate',
    },
    {
      handler: ordersReportHandler,
      method: 'get',
      path: '/reports/orders',
    },
    {
      handler: productVersionsAuditHandler,
      method: 'get',
      path: '/maintenance/products/version-audit',
    },
    {
      handler: productVersionsRepairHandler,
      method: 'get',
      path: '/maintenance/products/version-repair',
    },
    {
      handler: productVersionsRepairHandler,
      method: 'post',
      path: '/maintenance/products/version-repair',
    },
    {
      handler: boxNowLockersHandler,
      method: 'get',
      path: '/integrations/boxnow/lockers',
    },
    {
      handler: boxNowCreateShipmentHandler,
      method: 'post',
      path: '/integrations/boxnow/orders/:id/shipment',
    },
    {
      handler: boxNowParcelLabelHandler,
      method: 'get',
      path: '/integrations/boxnow/orders/:id/parcels/:parcelId/label.pdf',
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
    {
      handler: markProductReviewedHandler,
      method: 'post',
      path: '/maintenance/products/:id/reviewed',
    },
    {
      handler: catalogSyncAdminStatusHandler,
      method: 'get',
      path: '/maintenance/products/:id/catalog-sync',
    },
    {
      handler: catalogSyncAdminSendHandler,
      method: 'post',
      path: '/maintenance/products/:id/catalog-sync',
    },
  ],
  globals: [
    Header,
    Footer,
    TermsPage,
    PrivacyPage,
    ContactPage,
    ShopPage,
    PricingSettings,
    OrderSettings,
  ],
  plugins,
  jobs: {
    access: {
      cancel: ({ req }) => checkRole(['admin'], req.user),
      queue: ({ req }) => checkRole(['admin'], req.user),
      run: ({ req }) => checkRole(['admin'], req.user),
    },
    autoRun: [{ cron: '*/10 * * * * *', limit: 10, queue: 'merchant' }],
    enableConcurrencyControl: true,
    deleteJobOnComplete: false,
    tasks: [merchantProductTask, merchantReconcileTask],
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Sharp is now an optional dependency -
  // if you want to resize images, crop, set focal point, etc.
  // make sure to install it and pass it to the config.
  // sharp,
})
