import type { PayloadRequest } from 'payload'

import { buildCatalogSyncEvent } from './contract'
import { buildCatalogSyncCommerceEvent } from './commerceContract'
import { buildCatalogSyncFingerprints } from './fingerprints'
import { updateCatalogSyncProductState } from './state'
import type { CatalogSyncProductState } from './state'
import type { CatalogSyncEvent, CatalogSyncSourceProduct } from './types'

type CatalogSyncProductDocument = CatalogSyncSourceProduct & {
  catalogSync?: CatalogSyncProductState | null
  id: string
}

const relationID = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return String(value.id)
  return null
}

export const loadCatalogSyncProductForUser = async ({
  productId,
  req,
}: {
  productId: string
  req: PayloadRequest
}) =>
  (await req.payload.findByID({
    collection: 'products',
    depth: 2,
    id: productId,
    overrideAccess: false,
    req,
    user: req.user,
  })) as unknown as CatalogSyncProductDocument

export const loadCatalogSyncProductSystem = async ({
  productId,
  req,
}: {
  productId: string
  req: PayloadRequest
}) =>
  (await req.payload.findByID({
    collection: 'products',
    depth: 2,
    id: productId,
    overrideAccess: true,
    req,
  })) as unknown as CatalogSyncProductDocument

const findOutboxByDedupeKey = async ({
  dedupeKey,
  req,
}: {
  dedupeKey: string
  req: PayloadRequest
}) => {
  const result = await req.payload.find({
    collection: 'catalog-sync-outbox',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { dedupeKey: { equals: dedupeKey } },
  })
  return result.docs[0]
}

const findActiveCommerceOutbox = async ({
  commerceFingerprint,
  productId,
  req,
}: {
  commerceFingerprint: string
  productId: string
  req: PayloadRequest
}) => {
  const result = await req.payload.find({
    collection: 'catalog-sync-outbox',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    sort: '-createdAt',
    where: {
      and: [
        { action: { equals: 'commerce' } },
        { product: { equals: productId } },
        { commerceFingerprint: { equals: commerceFingerprint } },
        { status: { in: ['pending', 'sending', 'accepted', 'retry_wait', 'failed'] } },
      ],
    },
  })
  return result.docs[0]
}

export const enqueueCatalogContentSync = async ({
  product,
  req,
}: {
  product: CatalogSyncProductDocument
  req: PayloadRequest
}) => {
  const event = buildCatalogSyncEvent(product)
  const fingerprints = buildCatalogSyncFingerprints(product)
  const approved = product.catalogSync?.approved === true
  const action = approved ? 'content' : 'initial'
  const dedupeKey = `${action}:${event.eventId}`
  const existing = await findOutboxByDedupeKey({ dedupeKey, req })

  if (existing) {
    if (existing.status === 'failed') {
      await req.payload.update({
        collection: 'catalog-sync-outbox',
        data: { lastError: null, nextAttemptAt: new Date().toISOString(), status: 'pending' },
        id: existing.id,
        overrideAccess: true,
        req,
      })
    }
    return { action, event, fingerprints, outbox: existing, reused: true }
  }

  let outbox
  try {
    outbox = await req.payload.create({
      collection: 'catalog-sync-outbox',
      data: {
        action,
        attempts: 0,
        commerceFingerprint: fingerprints.commerce,
        contentFingerprint: fingerprints.content,
        dedupeKey,
        eventId: event.eventId,
        eventPayload: event,
        nextAttemptAt: new Date().toISOString(),
        product: product.id,
        status: 'pending',
      },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    const raced = await findOutboxByDedupeKey({ dedupeKey, req })
    if (raced) return { action, event, fingerprints, outbox: raced, reused: true }
    throw error
  }

  await updateCatalogSyncProductState({
    patch: {
      approvalStatus: approved ? 'approved' : 'pending',
      contentStatus: 'pending',
      lastError: null,
    },
    product,
    req,
  })

  return { action, event, fingerprints, outbox, reused: false }
}

export const enqueueCatalogCommerceSync = async ({
  product,
  req,
}: {
  product: CatalogSyncProductDocument
  req: PayloadRequest
}) => {
  if (product.catalogSync?.approved !== true) return null

  const fingerprints = buildCatalogSyncFingerprints(product)
  const event = buildCatalogSyncCommerceEvent(product)
  const dedupeKey = `commerce:${event.eventId}`
  const existing = await findActiveCommerceOutbox({
    commerceFingerprint: fingerprints.commerce,
    productId: String(product.id),
    req,
  })
  if (existing?.status === 'failed') {
    await req.payload.update({
      collection: 'catalog-sync-outbox',
      data: { lastError: null, nextAttemptAt: new Date().toISOString(), status: 'pending' },
      id: existing.id,
      overrideAccess: true,
      req,
    })
  } else if (!existing) {
    await req.payload.create({
      collection: 'catalog-sync-outbox',
      data: {
        action: 'commerce',
        attempts: 0,
        commerceFingerprint: fingerprints.commerce,
        commerceSnapshot: event.product,
        contentFingerprint: fingerprints.content,
        dedupeKey,
        eventId: event.eventId,
        eventPayload: event,
        nextAttemptAt: new Date().toISOString(),
        product: product.id,
        status: 'pending',
      },
      overrideAccess: true,
      req,
    })
  }
  return { event, fingerprints, outbox: existing || null }
}

export const productIDFromOutbox = (product: unknown) => relationID(product)

export const parseOutboxEvent = (value: unknown): CatalogSyncEvent => value as CatalogSyncEvent
