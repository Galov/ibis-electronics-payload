export const catalogSyncSchemaVersion = '1.2' as const
export const catalogSyncProductSchemaVersion = '1.1' as const
export const catalogSyncEventType = 'product.upsert' as const

export const catalogSyncStockStatuses = ['instock', 'outofstock', 'onbackorder', 'unknown'] as const

export type CatalogSyncStockStatus = (typeof catalogSyncStockStatuses)[number]

export type CatalogSyncCategoryIdentity = {
  sourceCategoryId: string
  title: string
}

export type CatalogSyncSourceCategory = {
  ancestors?: CatalogSyncCategoryIdentity[] | null
  id: number | string
  title?: null | string
}

export type CatalogSyncResolvedSourceCategory = CatalogSyncSourceCategory & {
  ancestors: CatalogSyncCategoryIdentity[]
  title: string
}

export type CatalogSyncProduct = {
  brand: null | {
    sourceBrandId: string
    title: string
  }
  categories: (CatalogSyncCategoryIdentity & {
    ancestors: CatalogSyncCategoryIdentity[]
  })[]
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
  schemaVersion: typeof catalogSyncProductSchemaVersion
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

export type CatalogSyncSourceProduct = {
  brand?: null | string | { id: number | string; title?: null | string }
  categories?: null | (number | string | CatalogSyncSourceCategory)[]
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
