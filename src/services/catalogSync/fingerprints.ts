import { normalizeCatalogSyncProduct, sha256, stableStringify } from './contract'
import { buildCatalogSyncCommerceFingerprint } from './commerceContract'
import type { CatalogSyncSourceProduct } from './types'

export type CatalogSyncFingerprints = {
  commerce: string
  content: string
}

export const buildCatalogSyncFingerprints = (
  source: CatalogSyncSourceProduct,
): CatalogSyncFingerprints => {
  const product = normalizeCatalogSyncProduct(source)
  const {
    sourcePriceEUR: _sourcePriceEUR,
    stockQty: _stockQty,
    stockStatus: _stockStatus,
    ...content
  } = product

  return {
    commerce: buildCatalogSyncCommerceFingerprint(source),
    content: sha256(stableStringify(content)),
  }
}
