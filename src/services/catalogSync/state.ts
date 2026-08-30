import type { PayloadRequest } from 'payload'

export const catalogSyncContext = {
  skipProductReviewQueue: true,
} as const

export type CatalogSyncProductState = {
  approved?: boolean | null
  approvalStatus?: 'never_sent' | 'pending' | 'approved' | 'error' | null
  contentStatus?: 'current' | 'changed' | 'pending' | 'error' | null
  lastContentFingerprint?: string | null
  lastAttemptedAt?: string | null
  lastError?: string | null
  lastErrorAt?: string | null
  lastErrorNotifiedEventId?: string | null
  lastEventId?: string | null
  lastEventSourceHash?: string | null
  lastEventSourceUpdatedAt?: string | null
  lastRemoteStatus?: string | null
  lastSuccessfulAt?: string | null
  lastSuccessfulEventId?: string | null
  pendingContentFingerprint?: string | null
}

type ProductWithCatalogSync = {
  catalogSync?: CatalogSyncProductState | null
  id: number | string
}

export const updateCatalogSyncProductState = async ({
  patch,
  product,
  req,
}: {
  patch: Partial<CatalogSyncProductState>
  product: ProductWithCatalogSync
  req: PayloadRequest
}) =>
  req.payload.update({
    collection: 'products',
    context: catalogSyncContext,
    data: {
      catalogSync: {
        ...(product.catalogSync || {}),
        ...patch,
      },
    },
    id: product.id,
    overrideAccess: true,
    req,
  })
