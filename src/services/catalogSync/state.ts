import type { PayloadRequest } from 'payload'

export const catalogSyncContext = {
  skipRomanianCatalogSync: true,
} as const

export type CatalogSyncProductState = {
  approved?: boolean | null
  approvalStatus?: 'never_sent' | 'pending' | 'approved' | 'error' | null
  commerceStatus?: 'current' | 'pending' | 'error' | null
  commerceLastError?: string | null
  contentStatus?: 'current' | 'changed' | 'pending' | 'error' | null
  contentLastError?: string | null
  lastAttemptCount?: number | null
  lastCommerceFingerprint?: string | null
  lastContentFingerprint?: string | null
  lastError?: string | null
  lastSuccessfulAt?: string | null
  lastSuccessfulEventId?: string | null
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
