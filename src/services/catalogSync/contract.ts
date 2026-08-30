import { createHash } from 'node:crypto'

import { CatalogSyncError } from './errors'
import {
  catalogSyncEventType,
  catalogSyncSchemaVersion,
  catalogSyncStockStatuses,
  type CatalogSyncEvent,
  type CatalogSyncProduct,
  type CatalogSyncSourceProduct,
  type CatalogSyncStockStatus,
} from './types'

const eventKeys = [
  'eventId',
  'eventType',
  'product',
  'schemaVersion',
  'sourceContentHash',
  'sourceUpdatedAt',
] as const

const productKeys = [
  'brand',
  'categories',
  'characteristics',
  'description',
  'imageAlts',
  'manufacturerCode',
  'originalSku',
  'schemaVersion',
  'shortDescription',
  'sku',
  'sourcePriceEUR',
  'sourceProductId',
  'stockQty',
  'stockStatus',
  'title',
] as const

const normalizeOptionalText = (value: unknown): null | string => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

const requireText = (value: unknown, field: string) => {
  const normalized = normalizeOptionalText(value)
  if (!normalized) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_PRODUCT', `${field} is required.`)
  }
  return normalized
}

const requireNonNegativeNumber = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_PRODUCT',
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

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

export const stableStringify = (value: unknown) => JSON.stringify(stableValue(value))

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

const deterministicEventID = ({
  sourceContentHash,
  sourceProductId,
  sourceUpdatedAt,
}: {
  sourceContentHash: string
  sourceProductId: string
  sourceUpdatedAt: string
}) => {
  const hex = sha256(
    `${catalogSyncSchemaVersion}:${catalogSyncEventType}:${sourceProductId}:${sourceUpdatedAt}:${sourceContentHash}`,
  ).slice(0, 32)
  const versioned = `${hex.slice(0, 12)}5${hex.slice(13, 16)}8${hex.slice(17)}`
  return `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12, 16)}-${versioned.slice(16, 20)}-${versioned.slice(20)}`
}

const normalizeBrand = (brand: CatalogSyncSourceProduct['brand']): CatalogSyncProduct['brand'] => {
  if (!brand) return null
  if (typeof brand !== 'object') {
    throw new CatalogSyncError(
      'CATALOG_SYNC_RELATION_NOT_POPULATED',
      'Product brand must be populated before catalog sync.',
    )
  }
  return {
    sourceBrandId: String(brand.id),
    title: requireText(brand.title, 'brand.title'),
  }
}

const normalizeCategories = (
  categories: CatalogSyncSourceProduct['categories'],
): CatalogSyncProduct['categories'] =>
  (categories || []).map((category, index) => {
    if (typeof category !== 'object') {
      throw new CatalogSyncError(
        'CATALOG_SYNC_RELATION_NOT_POPULATED',
        `Product category at index ${index} must be populated before catalog sync.`,
      )
    }
    return {
      sourceCategoryId: String(category.id),
      title: requireText(category.title, `categories[${index}].title`),
    }
  })

const normalizeImages = (
  images: CatalogSyncSourceProduct['images'],
): CatalogSyncProduct['imageAlts'] =>
  (images || []).map((image, index) => {
    const sharedMediaKey = normalizeOptionalText(image.storageKey)
    if (!sharedMediaKey) {
      throw new CatalogSyncError(
        'CATALOG_SYNC_MISSING_STORAGE_KEY',
        `Product image at index ${index} has no storageKey.`,
      )
    }
    const mediaAlt =
      image.image && typeof image.image === 'object' ? normalizeOptionalText(image.image.alt) : null
    return {
      alt: normalizeOptionalText(image.alt) || mediaAlt,
      sharedMediaKey,
    }
  })

export const normalizeCatalogSyncProduct = (
  source: CatalogSyncSourceProduct,
): CatalogSyncProduct => {
  const sourceProductId = requireText(
    typeof source.id === 'string' || typeof source.id === 'number' ? String(source.id) : null,
    'id',
  )
  return {
    brand: normalizeBrand(source.brand),
    categories: normalizeCategories(source.categories),
    characteristics: [],
    description: normalizeOptionalText(source.description),
    imageAlts: normalizeImages(source.images),
    manufacturerCode: normalizeOptionalText(source.manufacturerCode),
    originalSku: normalizeOptionalText(source.originalSku),
    schemaVersion: catalogSyncSchemaVersion,
    shortDescription: normalizeOptionalText(source.shortDescription),
    sku: requireText(source.sku, 'sku'),
    sourcePriceEUR: requireNonNegativeNumber(source.price, 'price'),
    sourceProductId,
    stockQty: requireNonNegativeNumber(source.stockQty, 'stockQty'),
    stockStatus: normalizeStockStatus(source.stockStatus),
    title: requireText(source.title, 'title'),
  }
}

export const buildCatalogSyncEvent = (
  source: CatalogSyncSourceProduct,
  options: { sourceUpdatedAt?: string } = {},
): CatalogSyncEvent => {
  const updatedAt = requireText(options.sourceUpdatedAt ?? source.updatedAt, 'updatedAt')
  const updatedAtDate = new Date(updatedAt)
  if (!Number.isFinite(updatedAtDate.getTime())) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_PRODUCT', 'updatedAt must be ISO-8601.')
  }
  const sourceUpdatedAt = updatedAtDate.toISOString()
  const product = normalizeCatalogSyncProduct(source)

  const sourceContentHash = sha256(stableStringify(product))
  const eventId = deterministicEventID({
    sourceContentHash,
    sourceProductId: product.sourceProductId,
    sourceUpdatedAt,
  })

  const event: CatalogSyncEvent = {
    eventId,
    eventType: catalogSyncEventType,
    product,
    schemaVersion: catalogSyncSchemaVersion,
    sourceContentHash,
    sourceUpdatedAt,
  }

  validateCatalogSyncEvent(event)
  return event
}

const assertExactKeys = (value: object, allowed: readonly string[], field: string) => {
  const actual = Object.keys(value).sort()
  const expected = [...allowed].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_CONTRACT',
      `${field} contains unexpected or missing fields.`,
    )
  }
}

export const validateCatalogSyncEvent = (event: CatalogSyncEvent) => {
  assertExactKeys(event, eventKeys, 'event')
  assertExactKeys(event.product, productKeys, 'product')
  if (event.product.brand) {
    assertExactKeys(event.product.brand, ['sourceBrandId', 'title'], 'product.brand')
  }
  event.product.categories.forEach((category, index) => {
    assertExactKeys(category, ['sourceCategoryId', 'title'], `product.categories[${index}]`)
  })
  event.product.characteristics.forEach((characteristic, index) => {
    assertExactKeys(characteristic, ['key', 'label', 'value'], `product.characteristics[${index}]`)
  })
  event.product.imageAlts.forEach((image, index) => {
    assertExactKeys(image, ['alt', 'sharedMediaKey'], `product.imageAlts[${index}]`)
  })

  if (event.schemaVersion !== catalogSyncSchemaVersion) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_CONTRACT', 'Unsupported event schemaVersion.')
  }
  if (event.eventType !== catalogSyncEventType) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_CONTRACT', 'Unsupported eventType.')
  }
  if (!/^[a-f0-9]{64}$/u.test(event.sourceContentHash)) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_CONTRACT', 'Invalid sourceContentHash.')
  }
  const expectedHash = sha256(stableStringify(event.product))
  if (event.sourceContentHash !== expectedHash) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_CONTRACT',
      'sourceContentHash does not match product content.',
    )
  }
  const expectedEventID = deterministicEventID({
    sourceContentHash: event.sourceContentHash,
    sourceProductId: event.product.sourceProductId,
    sourceUpdatedAt: event.sourceUpdatedAt,
  })
  if (event.eventId !== expectedEventID) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_CONTRACT',
      'eventId does not match the product event version.',
    )
  }
  requireNonNegativeNumber(event.product.sourcePriceEUR, 'sourcePriceEUR')
  requireNonNegativeNumber(event.product.stockQty, 'stockQty')
  if (!catalogSyncStockStatuses.includes(event.product.stockStatus)) {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_CONTRACT', 'Invalid stockStatus.')
  }
}
