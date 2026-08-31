import type { PayloadRequest, Where } from 'payload'

import { CatalogSyncError } from './errors'
import {
  buildVersionedCatalogSyncEvent,
  getCatalogSyncProductStatus,
  loadCatalogSyncProductForServer,
  markCatalogSyncProductFailed,
  refreshCatalogSyncProductStatus,
  sendCatalogSyncProductForUser,
  type CatalogSyncManualTransport,
  type CatalogSyncProductDocument,
} from './manual'
import {
  assertCatalogSyncSendingEnabled,
  getCatalogSyncEventStatus,
  sendCatalogSyncEvent,
} from './transport'
import type { CatalogSyncEnvironment } from './transport'

export type CatalogSyncBatchMode = 'dry-run' | 'retry-failed' | 'send'
export type CatalogSyncBatchOutcome =
  | 'already-current'
  | 'failed'
  | 'invalid'
  | 'needs-send'
  | 'succeeded'
  | 'superseded'
  | 'valid'

type BatchCandidate = { productId: string; sku: null | string }
type BatchResult = BatchCandidate & {
  eventId?: string
  outcome: CatalogSyncBatchOutcome
  reason?: string
}

type BatchCounters = {
  failedCount: number
  invalidCount: number
  sentCount: number
  skippedCurrentCount: number
  succeededCount: number
}

type BatchRun = BatchCounters & {
  activeCounted: boolean
  activeEventId: null | string
  activeProductId: null | string
  completedAt: null | string
  completionReason: null | 'exhausted' | 'limit_reached'
  id: string
  limit: number
  mode: Exclude<CatalogSyncBatchMode, 'dry-run'>
  nextIndex: number
  pollIntervalMs: number
  results: BatchResult[]
  snapshot: BatchCandidate[]
  startedAt: string
  status: 'completed' | 'running'
  timeoutMs: number
}

export type CatalogSyncBatchReport = {
  counts: {
    alreadyCurrent: number
    eligible: number
    failed: number
    invalid: number
    needsSend: number
    sent: number
    succeeded: number
    superseded: number
    valid: number
  }
  mode: CatalogSyncBatchMode
  resumedRun: boolean
  runId: null | string
}

type BatchPersistence = {
  createRun: (run: Omit<BatchRun, 'id'>) => Promise<BatchRun>
  findRunningRun: (mode: Exclude<CatalogSyncBatchMode, 'dry-run'>) => Promise<BatchRun | null>
  updateRun: (run: BatchRun) => Promise<BatchRun>
}

export type RunCatalogSyncBatchOptions = {
  env?: CatalogSyncEnvironment
  limit?: number
  mode?: CatalogSyncBatchMode
  now?: () => number
  onResult?: (result: BatchResult) => void
  persistence?: BatchPersistence
  pollIntervalMs?: number
  req: PayloadRequest
  sleep?: (milliseconds: number) => Promise<void>
  timeoutMs?: number
  transport?: CatalogSyncManualTransport
}

const defaultLimit = 20
const defaultPollIntervalMs = 2_000
const defaultTimeoutMs = 10 * 60_000
const pageSize = 100
const terminalSuccess = new Set(['succeeded', 'superseded'])

const asMessage = (error: unknown) =>
  error instanceof CatalogSyncError || error instanceof Error
    ? error.message
    : 'Неизвестна грешка при Catalog Sync batch обработката.'

const positiveInteger = (value: number, field: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMAND',
      `${field} must be a positive integer.`,
    )
  }
  return value
}

const candidateWhere = (mode: CatalogSyncBatchMode): Where => {
  const published: Where = { published: { equals: true } }
  if (mode !== 'retry-failed') return published
  return {
    and: [
      published,
      {
        or: [
          { 'catalogSync.approvalStatus': { equals: 'error' } },
          { 'catalogSync.contentStatus': { equals: 'error' } },
        ],
      },
    ],
  }
}

export const loadCatalogSyncBatchCandidates = async ({
  mode,
  req,
}: {
  mode: CatalogSyncBatchMode
  req: PayloadRequest
}) => {
  const candidates: BatchCandidate[] = []
  let page = 1

  while (true) {
    const result = await req.payload.find({
      collection: 'products',
      depth: 0,
      limit: pageSize,
      overrideAccess: true,
      page,
      req,
      sort: 'id',
      where: candidateWhere(mode),
    })
    candidates.push(
      ...result.docs.map((doc) => ({
        productId: String(doc.id),
        sku: typeof doc.sku === 'string' && doc.sku.trim() ? doc.sku.trim() : null,
      })),
    )
    if (!result.hasNextPage) break
    page += 1
  }

  return candidates
}

const normalizeRun = (document: Record<string, unknown>): BatchRun => ({
  activeCounted: document.activeCounted === true,
  activeEventId: typeof document.activeEventId === 'string' ? document.activeEventId : null,
  activeProductId: typeof document.activeProductId === 'string' ? document.activeProductId : null,
  completedAt: typeof document.completedAt === 'string' ? document.completedAt : null,
  completionReason:
    document.completionReason === 'exhausted' || document.completionReason === 'limit_reached'
      ? document.completionReason
      : null,
  failedCount: Number(document.failedCount) || 0,
  id: String(document.id),
  invalidCount: Number(document.invalidCount) || 0,
  limit: Number(document.limit),
  mode: document.mode === 'retry-failed' ? 'retry-failed' : 'send',
  nextIndex: Number(document.nextIndex) || 0,
  pollIntervalMs: Number(document.pollIntervalMs),
  results: Array.isArray(document.results) ? (document.results as BatchResult[]) : [],
  sentCount: Number(document.sentCount) || 0,
  skippedCurrentCount: Number(document.skippedCurrentCount) || 0,
  snapshot: Array.isArray(document.snapshot) ? (document.snapshot as BatchCandidate[]) : [],
  startedAt: String(document.startedAt),
  status: document.status === 'completed' ? 'completed' : 'running',
  succeededCount: Number(document.succeededCount) || 0,
  timeoutMs: Number(document.timeoutMs),
})

export const createPayloadBatchPersistence = (req: PayloadRequest): BatchPersistence => ({
  createRun: async (run) =>
    normalizeRun(
      (await req.payload.create({
        collection: 'catalog-sync-batch-runs',
        data: run,
        overrideAccess: true,
        req,
      })) as unknown as Record<string, unknown>,
    ),
  findRunningRun: async (mode) => {
    const result = await req.payload.find({
      collection: 'catalog-sync-batch-runs',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
      sort: '-createdAt',
      where: { and: [{ mode: { equals: mode } }, { status: { equals: 'running' } }] },
    })
    return result.docs[0]
      ? normalizeRun(result.docs[0] as unknown as Record<string, unknown>)
      : null
  },
  updateRun: async (run) =>
    normalizeRun(
      (await req.payload.update({
        collection: 'catalog-sync-batch-runs',
        data: {
          activeEventId: run.activeEventId,
          activeCounted: run.activeCounted,
          activeProductId: run.activeProductId,
          completedAt: run.completedAt,
          completionReason: run.completionReason,
          failedCount: run.failedCount,
          invalidCount: run.invalidCount,
          limit: run.limit,
          mode: run.mode,
          nextIndex: run.nextIndex,
          pollIntervalMs: run.pollIntervalMs,
          results: run.results,
          sentCount: run.sentCount,
          skippedCurrentCount: run.skippedCurrentCount,
          snapshot: run.snapshot,
          startedAt: run.startedAt,
          status: run.status,
          succeededCount: run.succeededCount,
          timeoutMs: run.timeoutMs,
        },
        id: run.id,
        overrideAccess: true,
        req,
      })) as unknown as Record<string, unknown>,
    ),
})

const initialCounters = (): BatchCounters => ({
  failedCount: 0,
  invalidCount: 0,
  sentCount: 0,
  skippedCurrentCount: 0,
  succeededCount: 0,
})

const reportFromResults = ({
  eligible,
  mode,
  results,
  resumedRun,
  run,
}: {
  eligible: number
  mode: CatalogSyncBatchMode
  results: BatchResult[]
  resumedRun: boolean
  run: BatchRun | null
}): CatalogSyncBatchReport => ({
  counts: {
    alreadyCurrent: results.filter(({ outcome }) => outcome === 'already-current').length,
    eligible,
    failed: results.filter(({ outcome }) => outcome === 'failed').length,
    invalid: results.filter(({ outcome }) => outcome === 'invalid').length,
    needsSend: results.filter(({ outcome }) => outcome === 'needs-send').length,
    sent: run?.sentCount || 0,
    succeeded: results.filter(({ outcome }) => outcome === 'succeeded').length,
    superseded: results.filter(({ outcome }) => outcome === 'superseded').length,
    valid: eligible - results.filter(({ outcome }) => outcome === 'invalid').length,
  },
  mode,
  resumedRun,
  runId: run?.id || null,
})

const dryRun = async ({
  candidates,
  onResult,
  req,
}: {
  candidates: BatchCandidate[]
  onResult: (result: BatchResult) => void
  req: PayloadRequest
}) => {
  const results: BatchResult[] = []
  for (const candidate of candidates) {
    try {
      const product = await loadCatalogSyncProductForServer({
        productId: candidate.productId,
        req,
      })
      buildVersionedCatalogSyncEvent(product)
      const status = getCatalogSyncProductStatus(product)
      const outcome =
        status.approved && status.contentStatus === 'current' ? 'already-current' : 'needs-send'
      const result: BatchResult = { ...candidate, outcome }
      results.push(result)
      onResult(result)
    } catch (error) {
      const result: BatchResult = { ...candidate, outcome: 'invalid', reason: asMessage(error) }
      results.push(result)
      onResult(result)
    }
  }
  return results
}

const pollUntilTerminal = async ({
  now,
  pollIntervalMs,
  product,
  req,
  sleep,
  timeoutMs,
  transport,
}: {
  now: () => number
  pollIntervalMs: number
  product: CatalogSyncProductDocument
  req: PayloadRequest
  sleep: (milliseconds: number) => Promise<void>
  timeoutMs: number
  transport: CatalogSyncManualTransport
}) => {
  const startedAt = now()
  let current = product

  while (getCatalogSyncProductStatus(current).contentStatus === 'pending') {
    if (now() - startedAt >= timeoutMs) {
      const eventId = current.catalogSync?.lastEventId || 'unknown'
      return markCatalogSyncProductFailed({
        error: `Romanian catalog sync did not finish within ${timeoutMs} ms.`,
        eventId,
        notify: false,
        product: current,
        req,
      })
    }
    await sleep(pollIntervalMs)
    try {
      current = await refreshCatalogSyncProductStatus({
        notifyOnFailure: false,
        product: current,
        req,
        transport,
      })
    } catch (error) {
      const eventId = current.catalogSync?.lastEventId || 'unknown'
      return markCatalogSyncProductFailed({
        error: asMessage(error),
        eventId,
        notify: false,
        product: current,
        req,
      })
    }
  }
  return current
}

export const runCatalogSyncBatch = async ({
  env,
  limit = defaultLimit,
  mode = 'dry-run',
  now = Date.now,
  onResult = () => undefined,
  persistence,
  pollIntervalMs = defaultPollIntervalMs,
  req,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = defaultTimeoutMs,
  transport = { getStatus: getCatalogSyncEventStatus, send: sendCatalogSyncEvent },
}: RunCatalogSyncBatchOptions): Promise<CatalogSyncBatchReport> => {
  positiveInteger(limit, 'limit')
  positiveInteger(pollIntervalMs, 'pollIntervalMs')
  positiveInteger(timeoutMs, 'timeoutMs')

  if (mode === 'dry-run') {
    const candidates = await loadCatalogSyncBatchCandidates({ mode, req })
    const results = await dryRun({ candidates, onResult, req })
    return reportFromResults({
      eligible: candidates.length,
      mode,
      results,
      resumedRun: false,
      run: null,
    })
  }

  assertCatalogSyncSendingEnabled(env)
  const store = persistence || createPayloadBatchPersistence(req)
  let run = await store.findRunningRun(mode)
  const resumedRun = Boolean(run)

  if (!run) {
    const snapshot = await loadCatalogSyncBatchCandidates({ mode, req })
    run = await store.createRun({
      ...initialCounters(),
      activeEventId: null,
      activeCounted: false,
      activeProductId: null,
      completedAt: null,
      completionReason: null,
      limit,
      mode,
      nextIndex: 0,
      pollIntervalMs,
      results: [],
      snapshot,
      startedAt: new Date(now()).toISOString(),
      status: 'running',
      timeoutMs,
    })
  }

  while (run.nextIndex < run.snapshot.length) {
    if (!run.activeProductId && run.sentCount >= run.limit) break
    const candidate = run.snapshot[run.nextIndex]
    let result: BatchResult

    try {
      let product = await loadCatalogSyncProductForServer({ productId: candidate.productId, req })
      const event = buildVersionedCatalogSyncEvent(product)
      const status = getCatalogSyncProductStatus(product)
      const isResumingActiveProduct = run.activeProductId === candidate.productId

      if (status.approved && status.contentStatus === 'current') {
        if (isResumingActiveProduct) {
          if (!run.activeCounted) run.sentCount += 1
          run.succeededCount += 1
          result = {
            ...candidate,
            eventId: run.activeEventId || status.lastEventId || undefined,
            outcome: terminalSuccess.has(status.lastRemoteStatus || '')
              ? (status.lastRemoteStatus as 'succeeded' | 'superseded')
              : 'succeeded',
          }
        } else {
          run.skippedCurrentCount += 1
          result = { ...candidate, outcome: 'already-current' }
        }
      } else if (status.contentStatus === 'pending' && status.lastEventId) {
        run.activeEventId = status.lastEventId
        run.activeProductId = candidate.productId
        if (!run.activeCounted) {
          run.activeCounted = true
          run.sentCount += 1
        }
        run = await store.updateRun(run)
        product = await pollUntilTerminal({
          now,
          pollIntervalMs: run.pollIntervalMs,
          product,
          req,
          sleep,
          timeoutMs: run.timeoutMs,
          transport,
        })
        const finalStatus = getCatalogSyncProductStatus(product)
        if (terminalSuccess.has(finalStatus.lastRemoteStatus || '')) {
          run.succeededCount += 1
          result = {
            ...candidate,
            eventId: finalStatus.lastEventId || undefined,
            outcome: finalStatus.lastRemoteStatus as 'succeeded' | 'superseded',
          }
        } else {
          run.failedCount += 1
          result = {
            ...candidate,
            eventId: finalStatus.lastEventId || undefined,
            outcome: 'failed',
            reason: finalStatus.lastError || 'Romanian catalog sync failed.',
          }
        }
      } else if (isResumingActiveProduct && run.activeCounted) {
        const interrupted = await markCatalogSyncProductFailed({
          error: 'Catalog Sync batch was interrupted after reserving this send attempt.',
          eventId: run.activeEventId || event.eventId,
          notify: false,
          product,
          req,
        })
        const interruptedStatus = getCatalogSyncProductStatus(interrupted)
        run.failedCount += 1
        result = {
          ...candidate,
          eventId: interruptedStatus.lastEventId || undefined,
          outcome: 'failed',
          reason: interruptedStatus.lastError || 'Catalog Sync batch was interrupted.',
        }
      } else {
        if (isResumingActiveProduct && !run.activeCounted) {
          run.activeEventId = null
          run.activeProductId = null
        }
        run.activeEventId = event.eventId
        run.activeProductId = candidate.productId
        run.activeCounted = false
        run = await store.updateRun(run)
        run.activeCounted = true
        run.sentCount += 1
        run = await store.updateRun(run)
        try {
          const sent = await sendCatalogSyncProductForUser({
            notifyOnFailure: false,
            product,
            req,
            transport,
          })
          product = await pollUntilTerminal({
            now,
            pollIntervalMs: run.pollIntervalMs,
            product: sent.product,
            req,
            sleep,
            timeoutMs: run.timeoutMs,
            transport,
          })
          const finalStatus = getCatalogSyncProductStatus(product)
          if (terminalSuccess.has(finalStatus.lastRemoteStatus || '')) {
            run.succeededCount += 1
            result = {
              ...candidate,
              eventId: sent.event.eventId,
              outcome: finalStatus.lastRemoteStatus as 'succeeded' | 'superseded',
            }
          } else {
            run.failedCount += 1
            result = {
              ...candidate,
              eventId: sent.event.eventId,
              outcome: 'failed',
              reason: finalStatus.lastError || 'Romanian catalog sync failed.',
            }
          }
        } catch (error) {
          run.failedCount += 1
          result = {
            ...candidate,
            eventId: event.eventId,
            outcome: 'failed',
            reason: asMessage(error),
          }
        }
      }
    } catch (error) {
      run.invalidCount += 1
      result = { ...candidate, outcome: 'invalid', reason: asMessage(error) }
    }

    run.activeEventId = null
    run.activeProductId = null
    run.activeCounted = false
    run.nextIndex += 1
    run.results.push(result)
    onResult(result)
    run = await store.updateRun(run)
  }

  run.status = 'completed'
  run.completionReason = run.nextIndex >= run.snapshot.length ? 'exhausted' : 'limit_reached'
  run.completedAt = new Date(now()).toISOString()
  run = await store.updateRun(run)

  return reportFromResults({
    eligible: run.snapshot.length,
    mode,
    results: run.results,
    resumedRun,
    run,
  })
}
