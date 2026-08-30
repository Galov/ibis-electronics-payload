import type { PayloadRequest } from 'payload'

import { resolveCatalogSyncProductCategoriesForUser } from './categories'
import { buildCatalogSyncEvent } from './contract'
import { CatalogSyncError } from './errors'
import { buildCatalogSyncContentFingerprint } from './fingerprints'
import { sendCatalogSyncFailureEmail } from './notifications'
import { updateCatalogSyncProductState } from './state'
import type { CatalogSyncProductState } from './state'
import { getCatalogSyncEventStatus, sendCatalogSyncEvent } from './transport'
import type {
  CatalogSyncAcceptedResponse,
  CatalogSyncEvent,
  CatalogSyncSourceProduct,
  CatalogSyncStatusResponse,
} from './types'

export type CatalogSyncProductDocument = CatalogSyncSourceProduct & {
  catalogSync?: CatalogSyncProductState | null
  id: string
}

type CatalogSyncManualTransport = {
  getStatus: (eventId: string) => Promise<CatalogSyncStatusResponse>
  send: (event: CatalogSyncEvent) => Promise<CatalogSyncAcceptedResponse>
}

const defaultTransport: CatalogSyncManualTransport = {
  getStatus: getCatalogSyncEventStatus,
  send: sendCatalogSyncEvent,
}

const successfulStatuses = new Set(['succeeded', 'superseded'])
const failedStatuses = new Set(['failed'])

const nextSourceUpdatedAt = (current: string, previous?: null | string) => {
  if (!previous) return current
  const currentTime = new Date(current).getTime()
  const previousTime = new Date(previous).getTime()
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(previousTime) ||
    currentTime > previousTime
  ) {
    return current
  }
  return new Date(previousTime + 1).toISOString()
}

const buildVersionedEvent = (product: CatalogSyncProductDocument) => {
  const candidate = buildCatalogSyncEvent(product)
  const state = product.catalogSync || {}

  if (state.lastEventSourceHash === candidate.sourceContentHash && state.lastEventSourceUpdatedAt) {
    return buildCatalogSyncEvent(product, {
      sourceUpdatedAt: state.lastEventSourceUpdatedAt,
    })
  }

  return buildCatalogSyncEvent(product, {
    sourceUpdatedAt: nextSourceUpdatedAt(candidate.sourceUpdatedAt, state.lastEventSourceUpdatedAt),
  })
}

const errorMessage = (error: unknown) =>
  error instanceof CatalogSyncError || error instanceof Error
    ? error.message
    : 'Неизвестна грешка при синхронизацията.'

const remoteErrorMessage = (response: CatalogSyncStatusResponse) =>
  typeof response.error === 'string' && response.error.trim()
    ? response.error.trim()
    : 'Румънската обработка завърши с грешка.'

const withState = (
  product: CatalogSyncProductDocument,
  state: CatalogSyncProductState,
): CatalogSyncProductDocument => ({ ...product, catalogSync: state })

export const loadCatalogSyncProductForUser = async ({
  productId,
  req,
}: {
  productId: string
  req: PayloadRequest
}) => {
  const product = (await req.payload.findByID({
    collection: 'products',
    depth: 2,
    id: productId,
    overrideAccess: false,
    req,
    user: req.user,
  })) as unknown as CatalogSyncProductDocument

  return (await resolveCatalogSyncProductCategoriesForUser({
    product,
    req,
  })) as CatalogSyncProductDocument
}

const persistState = async ({
  patch,
  product,
  req,
}: {
  patch: Partial<CatalogSyncProductState>
  product: CatalogSyncProductDocument
  req: PayloadRequest
}) => {
  const state = { ...(product.catalogSync || {}), ...patch }
  await updateCatalogSyncProductState({ patch, product, req })
  return withState(product, state)
}

const notifyFailure = async ({
  error,
  errorAt,
  eventId,
  product,
  req,
}: {
  error: string
  errorAt: string
  eventId: string
  product: CatalogSyncProductDocument
  req: PayloadRequest
}) => {
  if (product.catalogSync?.lastErrorNotifiedEventId === eventId) return product

  try {
    await sendCatalogSyncFailureEmail({
      error,
      errorAt,
      eventId,
      payload: req.payload,
      product,
    })
    return await persistState({
      patch: { lastErrorNotifiedEventId: eventId },
      product,
      req,
    })
  } catch (emailError) {
    req.payload.logger.error({
      err: emailError,
      msg: `Failed to send Romanian catalog sync failure email for product ${String(product.id)}`,
    })
    return product
  }
}

const markFailed = async ({
  error,
  eventId,
  product,
  req,
}: {
  error: string
  eventId: string
  product: CatalogSyncProductDocument
  req: PayloadRequest
}) => {
  const errorAt = new Date().toISOString()
  const failed = await persistState({
    patch: {
      approvalStatus: product.catalogSync?.approved ? 'approved' : 'error',
      contentStatus: 'error',
      lastError: error,
      lastErrorAt: errorAt,
      lastEventId: eventId,
      lastRemoteStatus: 'failed',
    },
    product,
    req,
  })
  await notifyFailure({ error, errorAt, eventId, product: failed, req })
  return failed
}

const markSucceeded = async ({
  eventId,
  product,
  remoteStatus,
  req,
}: {
  eventId: string
  product: CatalogSyncProductDocument
  remoteStatus: string
  req: PayloadRequest
}) => {
  const completedAt = new Date().toISOString()
  const currentFingerprint = buildCatalogSyncContentFingerprint(product)
  const sentFingerprint = product.catalogSync?.pendingContentFingerprint || currentFingerprint

  return persistState({
    patch: {
      approved: true,
      approvalStatus: 'approved',
      contentStatus: currentFingerprint === sentFingerprint ? 'current' : 'changed',
      lastContentFingerprint: sentFingerprint,
      lastError: null,
      lastErrorAt: null,
      lastEventId: eventId,
      lastRemoteStatus: remoteStatus,
      lastSuccessfulAt: completedAt,
      lastSuccessfulEventId: eventId,
      pendingContentFingerprint: null,
    },
    product,
    req,
  })
}

const applyRemoteStatus = async ({
  product,
  req,
  response,
}: {
  product: CatalogSyncProductDocument
  req: PayloadRequest
  response: CatalogSyncStatusResponse
}) => {
  if (successfulStatuses.has(response.status)) {
    return markSucceeded({
      eventId: response.eventId,
      product,
      remoteStatus: response.status,
      req,
    })
  }
  if (failedStatuses.has(response.status)) {
    return markFailed({
      error: remoteErrorMessage(response),
      eventId: response.eventId,
      product,
      req,
    })
  }
  if (product.catalogSync?.lastRemoteStatus === response.status) return product
  return persistState({
    patch: { lastRemoteStatus: response.status },
    product,
    req,
  })
}

export const getCatalogSyncProductStatus = (product: CatalogSyncProductDocument) => {
  const state = product.catalogSync || {}
  const currentFingerprint = buildCatalogSyncContentFingerprint(product)
  const approved = state.approved === true
  const contentStatus =
    state.contentStatus === 'pending' || state.contentStatus === 'error'
      ? state.contentStatus
      : approved && state.lastContentFingerprint !== currentFingerprint
        ? 'changed'
        : 'current'

  return {
    approved,
    approvalStatus: state.approvalStatus || 'never_sent',
    contentStatus,
    lastAttemptedAt: state.lastAttemptedAt || null,
    lastError: state.lastError || null,
    lastErrorAt: state.lastErrorAt || null,
    lastEventId: state.lastEventId || null,
    lastRemoteStatus: state.lastRemoteStatus || null,
    lastSuccessfulAt: state.lastSuccessfulAt || null,
    lastSuccessfulEventId: state.lastSuccessfulEventId || null,
  }
}

export const sendCatalogSyncProductForUser = async ({
  product,
  req,
  transport = defaultTransport,
}: {
  product: CatalogSyncProductDocument
  req: PayloadRequest
  transport?: CatalogSyncManualTransport
}) => {
  const event = buildVersionedEvent(product)
  const contentFingerprint = buildCatalogSyncContentFingerprint(product)
  const attemptedAt = new Date().toISOString()
  const pending = await persistState({
    patch: {
      approvalStatus: product.catalogSync?.approved ? 'approved' : 'pending',
      contentStatus: 'pending',
      lastAttemptedAt: attemptedAt,
      lastError: null,
      lastErrorAt: null,
      lastErrorNotifiedEventId: null,
      lastEventId: event.eventId,
      lastEventSourceHash: event.sourceContentHash,
      lastEventSourceUpdatedAt: event.sourceUpdatedAt,
      lastRemoteStatus: 'sending',
      pendingContentFingerprint: contentFingerprint,
    },
    product,
    req,
  })

  try {
    const response = await transport.send(event)
    const updated = await applyRemoteStatus({ product: pending, req, response })
    return { event, product: updated, response }
  } catch (error) {
    const message = errorMessage(error)
    await markFailed({ error: message, eventId: event.eventId, product: pending, req })
    throw error
  }
}

export const refreshCatalogSyncProductStatus = async ({
  product,
  req,
  transport = defaultTransport,
}: {
  product: CatalogSyncProductDocument
  req: PayloadRequest
  transport?: CatalogSyncManualTransport
}) => {
  const state = product.catalogSync || {}
  if (state.contentStatus !== 'pending' || !state.lastEventId) return product

  const response = await transport.getStatus(state.lastEventId)
  return applyRemoteStatus({ product, req, response })
}
