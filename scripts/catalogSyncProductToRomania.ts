import 'dotenv/config'

import {
  assertCatalogSyncSendingEnabled,
  CatalogSyncError,
  getCatalogSyncEventStatus,
  sendCatalogSyncProduct,
} from '@/services/catalogSync'

const usage = 'Usage: pnpm catalog-sync:product -- send <PayloadProductID> | status <eventId>'

const run = async () => {
  const [action, identifier, ...extra] = process.argv.slice(2)
  if (extra.length > 0 || !identifier || (action !== 'send' && action !== 'status')) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_COMMAND', usage)
  }

  if (action === 'status') {
    const response = await getCatalogSyncEventStatus(identifier)
    console.log(
      JSON.stringify({
        eventId: response.eventId,
        operation: 'status',
        status: response.status,
      }),
    )
    return
  }

  assertCatalogSyncSendingEnabled()
  const [{ default: configPromise }, { getPayload }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
  ])
  const payload = await getPayload({ config: configPromise })
  const { event, response } = await sendCatalogSyncProduct({
    payload,
    productId: identifier,
  })
  console.log(
    JSON.stringify({
      eventId: event.eventId,
      operation: 'send',
      productId: event.product.sourceProductId,
      sourceContentHash: event.sourceContentHash,
      status: response.status,
    }),
  )
}

run()
  .catch((error: unknown) => {
    if (error instanceof CatalogSyncError) {
      console.error(
        JSON.stringify({
          code: error.code,
          message: error.message,
          ...(error.status ? { status: error.status } : {}),
        }),
      )
    } else {
      console.error(
        JSON.stringify({
          code: 'CATALOG_SYNC_UNEXPECTED_ERROR',
          message: 'Catalog sync command failed unexpectedly.',
        }),
      )
    }
    process.exitCode = 1
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 0)
  })
