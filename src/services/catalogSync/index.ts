import type { Payload } from 'payload'

import { resolveCatalogSyncProductCategories } from './categories'
import { buildCatalogSyncEvent } from './contract'
import { sendCatalogSyncEvent, type CatalogSyncEnvironment } from './transport'

export { CatalogSyncError } from './errors'
export {
  createPayloadBatchPersistence,
  loadCatalogSyncBatchCandidates,
  runCatalogSyncBatch,
  type CatalogSyncBatchMode,
  type CatalogSyncBatchReport,
  type RunCatalogSyncBatchOptions,
} from './batch'
export { resolveCatalogSyncCategoryPaths } from './categories'
export { buildCatalogSyncEvent, stableStringify, validateCatalogSyncEvent } from './contract'
export {
  buildVersionedCatalogSyncEvent,
  getCatalogSyncProductStatus,
  loadCatalogSyncProductForServer,
  loadCatalogSyncProductForUser,
  markCatalogSyncProductFailed,
  refreshCatalogSyncProductStatus,
  sendCatalogSyncProductForUser,
} from './manual'
export { buildCatalogSyncContentFingerprint } from './fingerprints'
export {
  catalogSyncContext,
  updateCatalogSyncProductState,
  type CatalogSyncProductState,
} from './state'
export {
  assertCatalogSyncSendingEnabled,
  getCatalogSyncEventStatus,
  sendCatalogSyncEvent,
} from './transport'
export type * from './types'

export const loadCatalogSyncEvent = async ({
  payload,
  productId,
  onStage,
}: {
  payload: Payload
  productId: string
  onStage?: (stage: string) => void
}) => {
  onStage?.('load-product')
  const product = await payload.findByID({
    collection: 'products',
    depth: 2,
    id: productId,
    overrideAccess: true,
  })

  onStage?.('resolve-categories')
  const resolvedProduct = await resolveCatalogSyncProductCategories({ payload, product })
  onStage?.('build-event')
  return buildCatalogSyncEvent(resolvedProduct)
}

export const sendCatalogSyncProduct = async ({
  env,
  fetchImpl,
  payload,
  productId,
  timeoutMs,
  onStage,
}: {
  env?: CatalogSyncEnvironment
  fetchImpl?: typeof fetch
  payload: Payload
  productId: string
  timeoutMs?: number
  onStage?: (stage: string) => void
}) => {
  const event = await loadCatalogSyncEvent({ payload, productId, onStage })
  onStage?.('send-event')
  const response = await sendCatalogSyncEvent(event, { env, fetchImpl, timeoutMs })
  return { event, response }
}
