import 'dotenv/config'
import { catalogSyncErrorDetails } from '@/services/catalogSync/diagnostics'

import {
  assertCatalogSyncSendingEnabled,
  CatalogSyncError,
  getCatalogSyncEventStatus,
  sendCatalogSyncProduct,
} from '@/services/catalogSync'

const usage = 'Usage: pnpm catalog-sync:product -- send <PayloadProductID> | status <eventId>'
let stage = 'validate-command'

const run = async () => {
  const [action, identifier, ...extra] = process.argv.slice(2)
  if (extra.length > 0 || !identifier || (action !== 'send' && action !== 'status')) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_COMMAND', usage)
  }

  if (action === 'status') {
    stage = 'fetch-status'
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

  stage = 'check-send-enabled'
  assertCatalogSyncSendingEnabled()
  stage = 'load-config'
  const [{ default: configPromise }, { getPayload }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
  ])
  stage = 'initialize-payload'
  const payload = await getPayload({ config: configPromise })
  const { event, response } = await sendCatalogSyncProduct({
    payload,
    productId: identifier,
    onStage: (value) => {
      stage = value
    },
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
          stage,
          details: catalogSyncErrorDetails(error),
          message: error.message,
          ...(error.status ? { status: error.status } : {}),
        }),
      )
    } else {
      console.error(
        JSON.stringify({
          code: 'CATALOG_SYNC_UNEXPECTED_ERROR',
          stage,
          details: catalogSyncErrorDetails(error),
          message: 'Catalog sync command failed unexpectedly.',
        }),
      )
    }
    process.exitCode = 1
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 0)
  })
