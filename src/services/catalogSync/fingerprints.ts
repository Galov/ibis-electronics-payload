import { normalizeCatalogSyncProduct, sha256, stableStringify } from './contract'
import type { CatalogSyncSourceProduct } from './types'

export type CatalogSyncFingerprints = {
  commerce: string
  content: string
}

export const buildCatalogSyncFingerprints = (
  source: CatalogSyncSourceProduct,
): CatalogSyncFingerprints => {
  const product = normalizeCatalogSyncProduct(source)
  const { sourcePriceEUR, stockQty, stockStatus, ...content } = product

  return {
    commerce: sha256(stableStringify({ sourcePriceEUR, stockQty, stockStatus })),
    content: sha256(stableStringify(content)),
  }
}
