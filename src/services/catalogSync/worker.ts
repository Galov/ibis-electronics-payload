import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import type { CatalogSyncOutbox } from '@/payload-types'

import { CatalogSyncError } from './errors'
import { buildCatalogSyncFingerprints } from './fingerprints'
import {
  loadCatalogSyncProductSystem,
  parseOutboxEvent,
  productIDFromOutbox,
  recordBlockedCommerceSync,
} from './outbox'
import { updateCatalogSyncProductState } from './state'
import { getCatalogSyncEventStatus, sendCatalogSyncEvent } from './transport'

const maxAttempts = 8
const statusPollDelayMs = 15_000
const leaseDurationMs = 60_000

type CatalogSyncWorkerTransport = {
  getStatus: typeof getCatalogSyncEventStatus
  send: typeof sendCatalogSyncEvent
}

const defaultTransport: CatalogSyncWorkerTransport = {
  getStatus: getCatalogSyncEventStatus,
  send: sendCatalogSyncEvent,
}

const retryDelay = (attempts: number) =>
  Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1))

const asErrorMessage = (error: unknown) =>
  error instanceof CatalogSyncError || error instanceof Error
    ? error.message
    : 'Неизвестна грешка при синхронизацията.'

const updateOutbox = ({
  data,
  id,
  req,
}: {
  data: Record<string, unknown>
  id: number | string
  req: PayloadRequest
}) =>
  req.payload.update({
    collection: 'catalog-sync-outbox',
    data,
    id,
    overrideAccess: true,
    req,
  })

const markProductSyncError = async ({
  attempts,
  error,
  productId,
  req,
}: {
  attempts: number
  error: string
  productId: string
  req: PayloadRequest
}) => {
  const product = await loadCatalogSyncProductSystem({ productId, req })
  await updateCatalogSyncProductState({
    patch: {
      approvalStatus: product.catalogSync?.approved ? 'approved' : 'error',
      contentStatus: 'error',
      lastAttemptCount: attempts,
      lastError: error,
    },
    product,
    req,
  })
}

const completeOutbox = async ({
  item,
  req,
}: {
  item: CatalogSyncOutbox
  req: PayloadRequest
}) => {
  const productId = productIDFromOutbox(item.product)
  if (!productId) throw new Error('Outbox item has no product ID.')
  const product = await loadCatalogSyncProductSystem({ productId, req })
  const current = buildCatalogSyncFingerprints(product)
  const completedAt = new Date().toISOString()

  if (current.commerce !== item.commerceFingerprint) {
    await recordBlockedCommerceSync({ product, req })
  }

  await updateOutbox({
    data: { completedAt, lastError: null, leaseExpiresAt: null, status: 'succeeded' },
    id: item.id,
    req,
  })
  await updateCatalogSyncProductState({
    patch: {
      approved: true,
      approvalStatus: 'approved',
      commerceStatus:
        current.commerce === item.commerceFingerprint ? 'current' : 'blocked_contract',
      contentStatus: current.content === item.contentFingerprint ? 'current' : 'changed',
      lastAttemptCount: item.attempts || 0,
      lastCommerceFingerprint: item.commerceFingerprint,
      lastContentFingerprint: item.contentFingerprint,
      lastError: null,
      lastSuccessfulAt: completedAt,
      lastSuccessfulEventId: item.eventId,
    },
    product,
    req,
  })
}

const handleRemoteStatus = async ({
  item,
  req,
  transport,
}: {
  item: CatalogSyncOutbox
  req: PayloadRequest
  transport: CatalogSyncWorkerTransport
}) => {
  const response = await transport.getStatus(String(item.eventId))
  if (response.status === 'succeeded' || response.status === 'superseded') {
    await completeOutbox({ item, req })
    return
  }
  if (response.status === 'failed') {
    throw new CatalogSyncError(
      'CATALOG_SYNC_REMOTE_FAILED',
      typeof response.error === 'string' && response.error
        ? response.error
        : 'Румънската обработка завърши с грешка.',
    )
  }
  await updateOutbox({
    data: {
      leaseExpiresAt: null,
      nextAttemptAt: new Date(Date.now() + statusPollDelayMs).toISOString(),
      status: 'accepted',
    },
    id: item.id,
    req,
  })
}

export const processCatalogSyncOutboxItem = async ({
  item,
  req,
  transport = defaultTransport,
}: {
  item: CatalogSyncOutbox
  req: PayloadRequest
  transport?: CatalogSyncWorkerTransport
}) => {
  if (item.action === 'commerce') return
  const productId = productIDFromOutbox(item.product)
  if (!productId) throw new Error('Outbox item has no product ID.')
  const attempts = Number(item.attempts || 0) + (item.status === 'accepted' ? 0 : 1)

  await updateOutbox({
    data: {
      attempts,
      leaseExpiresAt: new Date(Date.now() + leaseDurationMs).toISOString(),
      status: 'sending',
    },
    id: item.id,
    req,
  })

  try {
    if (item.status === 'accepted') {
      await handleRemoteStatus({ item: { ...item, attempts }, req, transport })
      return
    }

    const event = parseOutboxEvent(item.eventPayload)
    const response = await transport.send(event)
    if (response.status === 'succeeded' || response.status === 'superseded') {
      await completeOutbox({ item: { ...item, attempts }, req })
      return
    }
    await updateOutbox({
      data: {
        acceptedAt: new Date().toISOString(),
        attempts,
        lastError: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(Date.now() + statusPollDelayMs).toISOString(),
        status: 'accepted',
      },
      id: item.id,
      req,
    })
  } catch (error) {
    const message = asErrorMessage(error)
    const exhausted = attempts >= maxAttempts
    await updateOutbox({
      data: {
        attempts,
        lastError: message,
        leaseExpiresAt: null,
        nextAttemptAt: exhausted ? null : new Date(Date.now() + retryDelay(attempts)).toISOString(),
        status: exhausted ? 'failed' : 'retry_wait',
      },
      id: item.id,
      req,
    })
    await markProductSyncError({ attempts, error: message, productId, req })
  }
}

export const runCatalogSyncOutboxBatch = async ({
  limit = 5,
  payload,
}: {
  limit?: number
  payload: Payload
}) => {
  const req = await createLocalReq({}, payload)
  const now = new Date().toISOString()
  const result = await payload.find({
    collection: 'catalog-sync-outbox',
    depth: 0,
    limit,
    overrideAccess: true,
    pagination: false,
    req,
    sort: 'createdAt',
    where: {
      or: [
        {
          and: [
            { status: { in: ['pending', 'accepted', 'retry_wait'] } },
            {
              or: [
                { nextAttemptAt: { less_than_equal: now } },
                { nextAttemptAt: { exists: false } },
              ],
            },
          ],
        },
        {
          and: [{ status: { equals: 'sending' } }, { leaseExpiresAt: { less_than_equal: now } }],
        },
      ],
    },
  })

  for (const item of result.docs) {
    await processCatalogSyncOutboxItem({ item, req })
  }
  return result.docs.length
}
