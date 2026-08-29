import { createLocalReq, type Payload, type PayloadRequest, type Where } from 'payload'

import type { CatalogSyncOutbox } from '@/payload-types'

import { parseCatalogSyncCommerceEvent } from './commerceContract'
import { CatalogSyncError } from './errors'
import { buildCatalogSyncFingerprints } from './fingerprints'
import {
  enqueueCatalogCommerceSync,
  loadCatalogSyncProductSystem,
  parseOutboxEvent,
  productIDFromOutbox,
} from './outbox'
import { updateCatalogSyncProductState } from './state'
import {
  getCatalogSyncEventStatus,
  getEnabledCatalogSyncWorkerActions,
  sendCatalogSyncCommerceEvent,
  sendCatalogSyncEvent,
} from './transport'

const maxAttempts = 8
const statusPollDelayMs = 15_000
const leaseDurationMs = 60_000

type CatalogSyncWorkerTransport = {
  getStatus: typeof getCatalogSyncEventStatus
  sendCommerce: typeof sendCatalogSyncCommerceEvent
  sendContent: typeof sendCatalogSyncEvent
}

const defaultTransport: CatalogSyncWorkerTransport = {
  getStatus: getCatalogSyncEventStatus,
  sendCommerce: sendCatalogSyncCommerceEvent,
  sendContent: sendCatalogSyncEvent,
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
  action,
  attempts,
  error,
  productId,
  req,
}: {
  action: CatalogSyncOutbox['action']
  attempts: number
  error: string
  productId: string
  req: PayloadRequest
}) => {
  const product = await loadCatalogSyncProductSystem({ productId, req })
  await updateCatalogSyncProductState({
    patch:
      action === 'commerce'
        ? {
            commerceLastError: error,
            commerceStatus: 'error',
            lastAttemptCount: attempts,
          }
        : {
            approvalStatus: product.catalogSync?.approved ? 'approved' : 'error',
            contentLastError: error,
            contentStatus: 'error',
            lastAttemptCount: attempts,
            lastError: error,
          },
    product,
    req,
  })
}

const markOutboxSucceeded = ({
  completedAt,
  item,
  req,
}: {
  completedAt: string
  item: CatalogSyncOutbox
  req: PayloadRequest
}) =>
  updateOutbox({
    data: { completedAt, lastError: null, leaseExpiresAt: null, status: 'succeeded' },
    id: item.id,
    req,
  })

const completeContentOutbox = async ({
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
  const commerceChanged = current.commerce !== item.commerceFingerprint

  await markOutboxSucceeded({ completedAt, item, req })
  await updateCatalogSyncProductState({
    patch: {
      approved: true,
      approvalStatus: 'approved',
      commerceLastError: null,
      commerceStatus: commerceChanged ? 'pending' : 'current',
      contentLastError: null,
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

  if (commerceChanged) {
    const approvedProduct = await loadCatalogSyncProductSystem({ productId, req })
    await enqueueCatalogCommerceSync({ product: approvedProduct, req })
  }
}

const completeCommerceOutbox = async ({
  item,
  remoteStatus,
  req,
}: {
  item: CatalogSyncOutbox
  remoteStatus: 'succeeded' | 'superseded'
  req: PayloadRequest
}) => {
  const productId = productIDFromOutbox(item.product)
  if (!productId) throw new Error('Outbox item has no product ID.')
  const product = await loadCatalogSyncProductSystem({ productId, req })
  const current = buildCatalogSyncFingerprints(product)
  const completedAt = new Date().toISOString()
  const commerceChanged = current.commerce !== item.commerceFingerprint

  await markOutboxSucceeded({ completedAt, item, req })

  if (remoteStatus === 'superseded') {
    const alreadyCurrent = current.commerce === product.catalogSync?.lastCommerceFingerprint
    await updateCatalogSyncProductState({
      patch: {
        commerceLastError: alreadyCurrent
          ? null
          : 'Румънският сайт вече има по-ново търговско събитие.',
        commerceStatus: alreadyCurrent ? 'current' : 'error',
        lastAttemptCount: item.attempts || 0,
        lastSuccessfulAt: completedAt,
        lastSuccessfulEventId: item.eventId,
      },
      product,
      req,
    })
    return
  }

  await updateCatalogSyncProductState({
    patch: {
      commerceLastError: null,
      commerceStatus: commerceChanged ? 'pending' : 'current',
      lastAttemptCount: item.attempts || 0,
      lastCommerceFingerprint: item.commerceFingerprint,
      lastSuccessfulAt: completedAt,
      lastSuccessfulEventId: item.eventId,
    },
    product,
    req,
  })

  if (commerceChanged) {
    const latestProduct = await loadCatalogSyncProductSystem({ productId, req })
    await enqueueCatalogCommerceSync({ product: latestProduct, req })
  }
}

const completeOutbox = async ({
  item,
  remoteStatus,
  req,
}: {
  item: CatalogSyncOutbox
  remoteStatus: 'succeeded' | 'superseded'
  req: PayloadRequest
}) => {
  if (item.action === 'commerce') {
    await completeCommerceOutbox({ item, remoteStatus, req })
    return
  }
  await completeContentOutbox({ item, req })
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
    await completeOutbox({ item, remoteStatus: response.status, req })
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

const rejectUnapprovedCommerceItem = async ({
  item,
  productId,
  req,
}: {
  item: CatalogSyncOutbox
  productId: string
  req: PayloadRequest
}) => {
  const message = 'Commerce sync requires a successfully approved Romanian product.'
  await updateOutbox({
    data: { lastError: message, leaseExpiresAt: null, nextAttemptAt: null, status: 'failed' },
    id: item.id,
    req,
  })
  await markProductSyncError({
    action: 'commerce',
    attempts: item.attempts || 0,
    error: message,
    productId,
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
  const productId = productIDFromOutbox(item.product)
  if (!productId) throw new Error('Outbox item has no product ID.')

  if (item.action === 'commerce') {
    const product = await loadCatalogSyncProductSystem({ productId, req })
    if (product.catalogSync?.approved !== true) {
      await rejectUnapprovedCommerceItem({ item, productId, req })
      return
    }
  }

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

    const response =
      item.action === 'commerce'
        ? await transport.sendCommerce(parseCatalogSyncCommerceEvent(item.eventPayload))
        : await transport.sendContent(parseOutboxEvent(item.eventPayload))
    if (response.status === 'succeeded' || response.status === 'superseded') {
      await completeOutbox({ item: { ...item, attempts }, remoteStatus: response.status, req })
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
    await markProductSyncError({ action: item.action, attempts, error: message, productId, req })
  }
}

export const buildCatalogSyncOutboxWhere = (
  enabledActions: CatalogSyncOutbox['action'][],
  now: string,
): Where => ({
  and: [
    { action: { in: enabledActions } },
    {
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
  ],
})

export const runCatalogSyncOutboxBatch = async ({
  enabledActions = getEnabledCatalogSyncWorkerActions(),
  limit = 5,
  payload,
}: {
  enabledActions?: CatalogSyncOutbox['action'][]
  limit?: number
  payload: Payload
}) => {
  if (enabledActions.length === 0) return 0

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
    where: buildCatalogSyncOutboxWhere(enabledActions, now),
  })

  for (const item of result.docs) {
    await processCatalogSyncOutboxItem({ item, req })
  }
  return result.docs.length
}
