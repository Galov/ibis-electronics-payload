export const catalogSyncSchemaVersion = '1.0' as const
export const catalogSyncEventType = 'product.upsert' as const
export const catalogSyncCommerceSchemaVersion = '1.1' as const
export const catalogSyncCommerceEventType = 'product.commerce_updated' as const

export const catalogSyncStockStatuses = ['instock', 'outofstock', 'onbackorder', 'unknown'] as const

export type CatalogSyncStockStatus = (typeof catalogSyncStockStatuses)[number]

export type CatalogSyncProduct = {
  brand: null | {
    sourceBrandId: string
    title: string
  }
  categories: {
    sourceCategoryId: string
    title: string
  }[]
  characteristics: {
    key: string
    label: string
    value: string
  }[]
  description: null | string
  imageAlts: {
    alt: null | string
    sharedMediaKey: string
  }[]
  manufacturerCode: null | string
  originalSku: null | string
  schemaVersion: typeof catalogSyncSchemaVersion
  shortDescription: null | string
  sku: string
  sourcePriceEUR: number
  sourceProductId: string
  stockQty: number
  stockStatus: CatalogSyncStockStatus
  title: string
}

export type CatalogSyncEvent = {
  eventId: string
  eventType: typeof catalogSyncEventType
  product: CatalogSyncProduct
  schemaVersion: typeof catalogSyncSchemaVersion
  sourceContentHash: string
  sourceUpdatedAt: string
}

export type CatalogSyncCommerceProduct = {
  sourcePriceEUR: number
  sourceProductId: string
  stockQty: number
  stockStatus: CatalogSyncStockStatus
}

export type CatalogSyncCommerceEvent = {
  eventId: string
  eventType: typeof catalogSyncCommerceEventType
  product: CatalogSyncCommerceProduct
  schemaVersion: typeof catalogSyncCommerceSchemaVersion
  sourceCommerceHash: string
  sourceUpdatedAt: string
}

export type CatalogSyncOutboundEvent = CatalogSyncCommerceEvent | CatalogSyncEvent

export type CatalogSyncSourceProduct = {
  brand?: null | string | { id: number | string; title?: null | string }
  categories?: null | (number | string | { id: number | string; title?: null | string })[]
  description?: null | string
  id: number | string
  images?:
    | null
    | {
        alt?: null | string
        image?: null | number | string | { alt?: null | string; id?: number | string }
        storageKey?: null | string
      }[]
  manufacturerCode?: null | string
  originalSku?: null | string
  price?: null | number
  shortDescription?: null | string
  sku?: null | string
  stockQty?: null | number
  stockStatus?: null | string
  title?: null | string
  updatedAt?: null | string
}

export type CatalogSyncAcceptedResponse = {
  eventId: string
  productId?: null | string
  replay?: boolean
  status: string
}

export type CatalogSyncStatusResponse = {
  eventId: string
  status: string
  [key: string]: unknown
}
