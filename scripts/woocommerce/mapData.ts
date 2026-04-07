import path from 'node:path'

import type {
  ImportOptions,
  ImportReport,
  LegacyAttachmentRecord,
  LegacySourceData,
  NormalizedBrand,
  NormalizedCategory,
  NormalizedImage,
  NormalizedProduct,
} from './types'

export function normalizeCategories(source: LegacySourceData): NormalizedCategory[] {
  return [...source.termTaxonomies.values()]
    .filter((taxonomy) => taxonomy.taxonomy === 'product_cat')
    .map((taxonomy) => {
      const term = source.terms.get(taxonomy.termId)

      if (!term) return null

      return {
        parentSourceTermId: taxonomy.parent || undefined,
        productCount: taxonomy.count,
        slug: ensureSlug(term.slug, term.name, taxonomy.id),
        sourceTaxonomyId: taxonomy.id,
        sourceTermId: taxonomy.termId,
        title: term.name,
      } satisfies NormalizedCategory
    })
    .filter(Boolean) as NormalizedCategory[]
}

export function normalizeBrands(source: LegacySourceData): NormalizedBrand[] {
  return [...source.termTaxonomies.values()]
    .filter((taxonomy) => taxonomy.taxonomy === 'pwb-brand')
    .map((taxonomy) => {
      const term = source.terms.get(taxonomy.termId)

      if (!term) return null

      return {
        productCount: taxonomy.count,
        slug: ensureSlug(term.slug, term.name, taxonomy.id),
        sourceTaxonomyId: taxonomy.id,
        sourceTermId: taxonomy.termId,
        title: term.name,
      } satisfies NormalizedBrand
    })
    .filter(Boolean) as NormalizedBrand[]
}

export function normalizeProducts(source: LegacySourceData, options: ImportOptions): NormalizedProduct[] {
  return [...source.posts.values()].map((post) => {
    const meta = source.postMeta.get(post.id) || new Map<string, string>()
    const taxonomyIds = source.termRelationships.get(post.id) || []
    const categories: number[] = []
    let brandSourceTaxonomyId: number | undefined

    for (const taxonomyId of taxonomyIds) {
      const taxonomy = source.termTaxonomies.get(taxonomyId)

      if (!taxonomy) continue

      if (taxonomy.taxonomy === 'product_cat') categories.push(taxonomy.id)
      if (taxonomy.taxonomy === 'pwb-brand' && !brandSourceTaxonomyId) brandSourceTaxonomyId = taxonomy.id
    }

    const images = resolveImages({
      attachments: source.attachments,
      legacySiteUrl: options.legacySiteUrl,
      uploadsBaseUrl: options.uploadsBaseUrl,
      galleryMeta: meta.get('_product_image_gallery'),
      thumbnailMeta: meta.get('_thumbnail_id'),
    })

    return {
      backordersAllowed: toBackordersAllowed(meta.get('_backorders')),
      brandSourceTaxonomyId,
      categorySourceTaxonomyIds: categories,
      description: emptyToUndefined(post.content),
      images: images.map(({ alt, legacyUrl, storageKey }) => ({ alt, legacyUrl, storageKey })),
      imagesMigrated: false,
      legacyAttachmentIDs: images.map((image) => image.id),
      legacyModifiedAt: emptyToUndefined(post.modifiedAt),
      legacyProductUrl: emptyToUndefined(post.guid),
      manageStock: meta.get('_manage_stock') === 'yes',
      manufacturerCode: emptyToUndefined(meta.get('product_manufacturer')),
      originalSku: emptyToUndefined(meta.get('product_original_sku')),
      price: 0,
      published: post.status === 'publish',
      shortDescription: emptyToUndefined(post.excerpt),
      sku: emptyToUndefined(meta.get('_sku')),
      slug: ensureSlug(post.slug, post.title, post.id),
      sourceId: post.id,
      stockQty: toNumber(meta.get('_stock')) || 0,
      stockStatus: normalizeStockStatus(meta.get('_stock_status')),
      title: post.title.trim() || `Product ${post.id}`,
    }
  })
}

export function buildImportReport(
  categories: NormalizedCategory[],
  brands: NormalizedBrand[],
  products: NormalizedProduct[],
): ImportReport {
  return {
    brands: brands.length,
    categories: categories.length,
    failedProducts: 0,
    products: products.length,
    productsMissingImages: products.filter((product) => product.images.length === 0).length,
    productsMissingSku: products.filter((product) => !product.sku).length,
    productsWithZeroPrice: products.filter((product) => product.price <= 0).length,
    succeededProducts: 0,
  }
}

function resolveImages({
  attachments,
  galleryMeta,
  legacySiteUrl,
  thumbnailMeta,
  uploadsBaseUrl,
}: {
  attachments: Map<number, LegacyAttachmentRecord>
  galleryMeta?: string
  legacySiteUrl?: string
  thumbnailMeta?: string
  uploadsBaseUrl?: string
}): Array<NormalizedImage & { id: number }> {
  const orderedIDs = new Set<number>()
  const results: Array<NormalizedImage & { id: number }> = []

  const thumbnailID = toNumber(thumbnailMeta)
  if (thumbnailID) orderedIDs.add(thumbnailID)

  for (const id of splitIntegerList(galleryMeta)) orderedIDs.add(id)

  for (const id of orderedIDs) {
    const attachment = attachments.get(id)
    const legacyUrl = resolveAttachmentURL(attachment, uploadsBaseUrl, legacySiteUrl)

    if (!legacyUrl) continue

    results.push({
      alt: attachment?.alt,
      id,
      legacyUrl,
      storageKey: undefined,
    })
  }

  return results
}

function resolveAttachmentURL(
  attachment: LegacyAttachmentRecord | undefined,
  uploadsBaseUrl?: string,
  legacySiteUrl?: string,
): string | undefined {
  if (!attachment) return undefined
  if (attachment.guid && /^https?:\/\//.test(attachment.guid)) return attachment.guid
  if (!attachment.filePath) return undefined

  const baseURL = uploadsBaseUrl || deriveUploadsBaseURL(legacySiteUrl)
  if (!baseURL) return undefined

  return `${baseURL.replace(/\/$/, '')}/${attachment.filePath.replace(/^\/+/, '')}`
}

function deriveUploadsBaseURL(legacySiteUrl?: string): string | undefined {
  if (!legacySiteUrl) return undefined

  return `${legacySiteUrl.replace(/\/$/, '')}/wp-content/uploads`
}

function splitIntegerList(value?: string): number[] {
  if (!value) return []

  return value
    .split(',')
    .map((part) => toNumber(part.trim()))
    .filter((part): part is number => Boolean(part))
}

function normalizeStockStatus(value?: string): NormalizedProduct['stockStatus'] {
  if (value === 'instock' || value === 'outofstock' || value === 'onbackorder') return value
  return 'unknown'
}

function toBackordersAllowed(value?: string): boolean {
  return Boolean(value && value !== 'no')
}

function toNumber(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function ensureSlug(value: string, fallback: string, sourceId: number): string {
  const candidate = value || fallback
  const normalized = candidate
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `legacy-${sourceId}`
}

function emptyToUndefined(value?: string): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  return normalized ? normalized : undefined
}
