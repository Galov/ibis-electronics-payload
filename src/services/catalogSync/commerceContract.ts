import { CatalogSyncError } from './errors'
import { sha256, stableStringify } from './contract'
import {
  catalogSyncCommerceEventType,
  catalogSyncCommerceSchemaVersion,
  catalogSyncStockStatuses,
  type CatalogSyncCommerceEvent,
  type CatalogSyncCommerceProduct,
  type CatalogSyncSourceProduct,
  type CatalogSyncStockStatus,
} from './types'

const eventKeys = [
  'eventId',
  'eventType',
  'product',
  'schemaVersion',
  'sourceCommerceHash',
  'sourceUpdatedAt',
] as const

const productKeys = ['sourcePriceEUR', 'sourceProductId', 'stockQty', 'stockStatus'] as const

const requireText = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_COMMERCE', `${field} is required.`)
  }
  return value.trim()
}

const requireNonNegativeNumber = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE',
      `${field} must be a finite non-negative number.`,
    )
  }
  return value
}

const normalizeStockStatus = (value: unknown): CatalogSyncStockStatus => {
  if (
    typeof value === 'string' &&
    catalogSyncStockStatuses.includes(value as CatalogSyncStockStatus)
  ) {
    return value as CatalogSyncStockStatus
  }
  return 'unknown'
}

const assertExactKeys = (value: object, allowed: readonly string[], field: string) => {
  const actual = Object.keys(value).sort()
  const expected = [...allowed].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      `${field} contains unexpected or missing fields.`,
    )
  }
}

const normalizeSourceUpdatedAt = (value: unknown) => {
  const sourceUpdatedAt = requireText(value, 'sourceUpdatedAt')
  const date = new Date(sourceUpdatedAt)
  if (!Number.isFinite(date.getTime())) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_COMMERCE', 'sourceUpdatedAt must be ISO-8601.')
  }
  return date.toISOString()
}

export const normalizeCatalogSyncCommerceProduct = (
  source: CatalogSyncSourceProduct,
): CatalogSyncCommerceProduct => {
  const sourceProductId =
    typeof source.id === 'string' || typeof source.id === 'number' ? String(source.id) : null
  return {
    sourcePriceEUR: requireNonNegativeNumber(source.price, 'sourcePriceEUR'),
    sourceProductId: requireText(sourceProductId, 'sourceProductId'),
    stockQty: requireNonNegativeNumber(source.stockQty, 'stockQty'),
    stockStatus: normalizeStockStatus(source.stockStatus),
  }
}

export const buildCatalogSyncCommerceFingerprint = (source: CatalogSyncSourceProduct) => {
  const product = normalizeCatalogSyncCommerceProduct(source)
  return sha256(
    stableStringify({
      sourcePriceEUR: product.sourcePriceEUR,
      stockQty: product.stockQty,
      stockStatus: product.stockStatus,
    }),
  )
}

const deterministicCommerceEventID = ({
  sourceCommerceHash,
  sourceProductId,
  sourceUpdatedAt,
}: {
  sourceCommerceHash: string
  sourceProductId: string
  sourceUpdatedAt: string
}) => {
  const hex = sha256(
    `${catalogSyncCommerceSchemaVersion}:${catalogSyncCommerceEventType}:${sourceProductId}:${sourceUpdatedAt}:${sourceCommerceHash}`,
  ).slice(0, 32)
  const versioned = `${hex.slice(0, 12)}5${hex.slice(13, 16)}8${hex.slice(17)}`
  return `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12, 16)}-${versioned.slice(16, 20)}-${versioned.slice(20)}`
}

export const buildCatalogSyncCommerceEvent = (
  source: CatalogSyncSourceProduct,
): CatalogSyncCommerceEvent => {
  const product = normalizeCatalogSyncCommerceProduct(source)
  const sourceUpdatedAt = normalizeSourceUpdatedAt(source.updatedAt)
  const sourceCommerceHash = buildCatalogSyncCommerceFingerprint(source)
  const event: CatalogSyncCommerceEvent = {
    eventId: deterministicCommerceEventID({
      sourceCommerceHash,
      sourceProductId: product.sourceProductId,
      sourceUpdatedAt,
    }),
    eventType: catalogSyncCommerceEventType,
    product,
    schemaVersion: catalogSyncCommerceSchemaVersion,
    sourceCommerceHash,
    sourceUpdatedAt,
  }
  validateCatalogSyncCommerceEvent(event)
  return event
}

export const parseCatalogSyncCommerceEvent = (value: unknown): CatalogSyncCommerceEvent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      'Commerce event must be an object.',
    )
  }
  validateCatalogSyncCommerceEvent(value as CatalogSyncCommerceEvent)
  return value as CatalogSyncCommerceEvent
}

export const validateCatalogSyncCommerceEvent = (event: CatalogSyncCommerceEvent) => {
  assertExactKeys(event, eventKeys, 'event')
  if (!event.product || typeof event.product !== 'object' || Array.isArray(event.product)) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      'product must be an object.',
    )
  }
  assertExactKeys(event.product, productKeys, 'product')
  if (event.schemaVersion !== catalogSyncCommerceSchemaVersion) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      'Unsupported commerce schemaVersion.',
    )
  }
  if (event.eventType !== catalogSyncCommerceEventType) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      'Unsupported commerce eventType.',
    )
  }
  requireText(event.eventId, 'eventId')
  requireText(event.product.sourceProductId, 'sourceProductId')
  requireNonNegativeNumber(event.product.sourcePriceEUR, 'sourcePriceEUR')
  requireNonNegativeNumber(event.product.stockQty, 'stockQty')
  if (!catalogSyncStockStatuses.includes(event.product.stockStatus)) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_COMMERCE_CONTRACT', 'Invalid stockStatus.')
  }
  normalizeSourceUpdatedAt(event.sourceUpdatedAt)
  if (!/^[a-f0-9]{64}$/u.test(event.sourceCommerceHash)) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      'Invalid sourceCommerceHash.',
    )
  }
  const expectedHash = sha256(
    stableStringify({
      sourcePriceEUR: event.product.sourcePriceEUR,
      stockQty: event.product.stockQty,
      stockStatus: event.product.stockStatus,
    }),
  )
  if (event.sourceCommerceHash !== expectedHash) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      'sourceCommerceHash does not match product commerce data.',
    )
  }
  const expectedEventID = deterministicCommerceEventID({
    sourceCommerceHash: event.sourceCommerceHash,
    sourceProductId: event.product.sourceProductId,
    sourceUpdatedAt: normalizeSourceUpdatedAt(event.sourceUpdatedAt),
  })
  if (event.eventId !== expectedEventID) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMERCE_CONTRACT',
      'eventId does not match the commerce event version.',
    )
  }
}
