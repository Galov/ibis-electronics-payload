import type { CollectionAfterChangeHook } from 'payload'

import {
  buildCatalogSyncFingerprints,
  enqueueCatalogCommerceSync,
  loadCatalogSyncProductSystem,
  updateCatalogSyncProductState,
} from '@/services/catalogSync'

export const syncRomanianCatalogAfterChange: CollectionAfterChangeHook = async ({
  context,
  doc,
  req,
}) => {
  if (context.skipRomanianCatalogSync || doc.catalogSync?.approved !== true) return doc

  try {
    const product = await loadCatalogSyncProductSystem({ productId: String(doc.id), req })
    const fingerprints = buildCatalogSyncFingerprints(product)
    const contentChanged = fingerprints.content !== product.catalogSync?.lastContentFingerprint
    const commerceChanged = fingerprints.commerce !== product.catalogSync?.lastCommerceFingerprint

    if (commerceChanged) {
      await enqueueCatalogCommerceSync({ product, req })
    }

    await updateCatalogSyncProductState({
      patch: {
        ...(commerceChanged ? { commerceLastError: null } : {}),
        commerceStatus: commerceChanged ? 'pending' : 'current',
        contentStatus: contentChanged ? 'changed' : 'current',
      },
      product,
      req,
    })
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Failed to record Romanian catalog drift for product ${String(doc.id)}`,
    })
  }

  return doc
}
