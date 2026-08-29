import type { Payload } from 'payload'

import { buildCatalogSyncEvent } from './contract'
import { sendCatalogSyncEvent, type CatalogSyncEnvironment } from './transport'

export { CatalogSyncError } from './errors'
export { buildCatalogSyncEvent, stableStringify, validateCatalogSyncEvent } from './contract'
export {
  buildCatalogSyncCommerceEvent,
  buildCatalogSyncCommerceFingerprint,
  normalizeCatalogSyncCommerceProduct,
  parseCatalogSyncCommerceEvent,
  validateCatalogSyncCommerceEvent,
} from './commerceContract'
export { buildCatalogSyncFingerprints } from './fingerprints'
export {
  enqueueCatalogContentSync,
  enqueueCatalogCommerceSync,
  loadCatalogSyncProductForUser,
  loadCatalogSyncProductSystem,
  parseOutboxEvent,
  productIDFromOutbox,
} from './outbox'
export {
  catalogSyncContext,
  updateCatalogSyncProductState,
  type CatalogSyncProductState,
} from './state'
export {
  assertCatalogSyncSendingEnabled,
  assertCatalogSyncCommerceSendingEnabled,
  getCatalogSyncEventStatus,
  getEnabledCatalogSyncWorkerActions,
  sendCatalogSyncCommerceEvent,
  sendCatalogSyncEvent,
} from './transport'
export {
  buildCatalogSyncOutboxWhere,
  processCatalogSyncOutboxItem,
  runCatalogSyncOutboxBatch,
} from './worker'
export type * from './types'

export const loadCatalogSyncEvent = async ({
  payload,
  productId,
}: {
  payload: Payload
  productId: string
}) => {
  const product = await payload.findByID({
    collection: 'products',
    depth: 2,
    id: productId,
    overrideAccess: true,
  })

  return buildCatalogSyncEvent(product)
}

export const sendCatalogSyncProduct = async ({
  env,
  fetchImpl,
  payload,
  productId,
  timeoutMs,
}: {
  env?: CatalogSyncEnvironment
  fetchImpl?: typeof fetch
  payload: Payload
  productId: string
  timeoutMs?: number
}) => {
  const event = await loadCatalogSyncEvent({ payload, productId })
  const response = await sendCatalogSyncEvent(event, { env, fetchImpl, timeoutMs })
  return { event, response }
}
