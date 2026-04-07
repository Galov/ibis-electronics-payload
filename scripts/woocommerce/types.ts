export type LegacyTaxonomy = 'product_cat' | 'pwb-brand' | 'product_type' | 'product_visibility'

export type LegacyPostRecord = {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string
  modifiedAt: string
  guid: string
  status: string
}

export type LegacyAttachmentRecord = {
  id: number
  guid: string
  filePath?: string
  alt?: string
}

export type LegacyTermRecord = {
  id: number
  name: string
  slug: string
}

export type LegacyTermTaxonomyRecord = {
  id: number
  termId: number
  taxonomy: LegacyTaxonomy | string
  parent: number
  count: number
}

export type LegacySourceData = {
  attachments: Map<number, LegacyAttachmentRecord>
  postMeta: Map<number, Map<string, string>>
  posts: Map<number, LegacyPostRecord>
  termRelationships: Map<number, number[]>
  termTaxonomies: Map<number, LegacyTermTaxonomyRecord>
  terms: Map<number, LegacyTermRecord>
}

export type NormalizedCategory = {
  sourceTermId: number
  sourceTaxonomyId: number
  title: string
  slug: string
  parentSourceTermId?: number
  productCount: number
}

export type NormalizedBrand = {
  sourceTermId: number
  sourceTaxonomyId: number
  title: string
  slug: string
  productCount: number
}

export type NormalizedImage = {
  alt?: string
  legacyUrl: string
  storageKey?: string
}

export type NormalizedProduct = {
  sourceId: number
  title: string
  slug: string
  description?: string
  shortDescription?: string
  sku?: string
  originalSku?: string
  manufacturerCode?: string
  brandSourceTaxonomyId?: number
  categorySourceTaxonomyIds: number[]
  price: number
  stockQty: number
  stockStatus: 'instock' | 'outofstock' | 'onbackorder' | 'unknown'
  manageStock: boolean
  backordersAllowed: boolean
  imagesMigrated: boolean
  images: NormalizedImage[]
  legacyAttachmentIDs: number[]
  legacyProductUrl?: string
  legacyModifiedAt?: string
  published: boolean
}

export type ImportReport = {
  brands: number
  categories: number
  failedProducts: number
  products: number
  productsMissingImages: number
  productsMissingSku: number
  productsWithZeroPrice: number
  succeededProducts?: number
}

export type ProductImportFailure = {
  batchStart: number
  brandSourceTaxonomyId?: number
  categorySourceTaxonomyIds: number[]
  descriptionPreview: string
  error: string
  existingProductId?: string | null
  productSlug: string
  sourceId: number
  title: string
}

export type ImportOptions = {
  batchSize: number
  dryRun: boolean
  dumpFile: string
  legacySiteUrl?: string
  uploadsBaseUrl?: string
}
