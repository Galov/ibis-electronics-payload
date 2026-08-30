import { normalizeCatalogSyncProduct, sha256, stableStringify } from './contract'
import type { CatalogSyncSourceProduct } from './types'

export const buildCatalogSyncContentFingerprint = (source: CatalogSyncSourceProduct) => {
  const product = normalizeCatalogSyncProduct(source)
  const {
    sourcePriceEUR: _sourcePriceEUR,
    stockQty: _stockQty,
    stockStatus: _stockStatus,
    ...content
  } = product

  return sha256(stableStringify(content))
}
