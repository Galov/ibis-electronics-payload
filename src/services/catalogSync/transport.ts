import { CatalogSyncError } from './errors'
import { validateCatalogSyncEvent } from './contract'
import { validateCatalogSyncCommerceEvent } from './commerceContract'
import type {
  CatalogSyncAcceptedResponse,
  CatalogSyncCommerceEvent,
  CatalogSyncEvent,
  CatalogSyncStatusResponse,
} from './types'

const catalogSyncBaseURL = 'https://ibis-electronics.ro'
const defaultTimeoutMs = 15_000

export type CatalogSyncEnvironment = {
  CATALOG_SYNC_API_KEY?: string
  CATALOG_SYNC_COMMERCE_SEND_ENABLED?: string
  CATALOG_SYNC_SEND_ENABLED?: string
}

type CatalogSyncTransportOptions = {
  env?: CatalogSyncEnvironment
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const resolveEnvironment = (env?: CatalogSyncEnvironment): CatalogSyncEnvironment =>
  env || {
    CATALOG_SYNC_API_KEY: process.env.CATALOG_SYNC_API_KEY,
    CATALOG_SYNC_COMMERCE_SEND_ENABLED: process.env.CATALOG_SYNC_COMMERCE_SEND_ENABLED,
    CATALOG_SYNC_SEND_ENABLED: process.env.CATALOG_SYNC_SEND_ENABLED,
  }

export const assertCatalogSyncSendingEnabled = (env?: CatalogSyncEnvironment) => {
  const resolvedEnvironment = resolveEnvironment(env)
  if (resolvedEnvironment.CATALOG_SYNC_SEND_ENABLED !== 'true') {
    throw new CatalogSyncError(
      'CATALOG_SYNC_SEND_DISABLED',
      'Catalog sync sending is disabled. Set CATALOG_SYNC_SEND_ENABLED=true explicitly.',
    )
  }
  return resolvedEnvironment
}

export const assertCatalogSyncCommerceSendingEnabled = (env?: CatalogSyncEnvironment) => {
  const resolvedEnvironment = resolveEnvironment(env)
  if (resolvedEnvironment.CATALOG_SYNC_COMMERCE_SEND_ENABLED !== 'true') {
    throw new CatalogSyncError(
      'CATALOG_SYNC_COMMERCE_SEND_DISABLED',
      'Catalog commerce sending is disabled. Set CATALOG_SYNC_COMMERCE_SEND_ENABLED=true explicitly.',
    )
  }
  return resolvedEnvironment
}

export const getEnabledCatalogSyncWorkerActions = (env?: CatalogSyncEnvironment) => {
  const resolvedEnvironment = resolveEnvironment(env)
  const actions: Array<'commerce' | 'content' | 'initial'> = []
  if (resolvedEnvironment.CATALOG_SYNC_SEND_ENABLED === 'true') {
    actions.push('initial', 'content')
  }
  if (resolvedEnvironment.CATALOG_SYNC_COMMERCE_SEND_ENABLED === 'true') {
    actions.push('commerce')
  }
  return actions
}

const getAPIKey = (env: CatalogSyncEnvironment) => {
  const apiKey = env.CATALOG_SYNC_API_KEY
  if (!apiKey) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_API_KEY_MISSING',
      'CATALOG_SYNC_API_KEY is not configured.',
    )
  }
  return apiKey
}

const parseJSON = async (response: Response) => {
  try {
    return (await response.json()) as unknown
  } catch (error) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_RESPONSE',
      'Romanian catalog sync returned invalid JSON.',
      { cause: error, status: response.status },
    )
  }
}

const request = async ({
  apiKey,
  body,
  fetchImpl,
  method,
  timeoutMs,
  url,
}: {
  apiKey: string
  body?: string
  fetchImpl: typeof fetch
  method: 'GET' | 'POST'
  timeoutMs: number
  url: string
}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetchImpl(url, {
      body,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method,
      signal: controller.signal,
    })
  } catch (error) {
    const timedOut = controller.signal.aborted
    throw new CatalogSyncError(
      timedOut ? 'CATALOG_SYNC_TIMEOUT' : 'CATALOG_SYNC_NETWORK_ERROR',
      timedOut
        ? 'Romanian catalog sync request timed out.'
        : 'Romanian catalog sync request failed.',
      { cause: error },
    )
  } finally {
    clearTimeout(timeout)
  }
}

const requireResponseIdentity = (
  value: unknown,
  expectedEventId?: string,
): CatalogSyncAcceptedResponse | CatalogSyncStatusResponse => {
  if (!value || typeof value !== 'object') {
    throw new CatalogSyncError('CATALOG_SYNC_INVALID_RESPONSE', 'Response must be a JSON object.')
  }
  const response = value as Record<string, unknown>
  if (typeof response.eventId !== 'string' || typeof response.status !== 'string') {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_RESPONSE',
      'Response must contain string eventId and status.',
    )
  }
  if (expectedEventId && response.eventId !== expectedEventId) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_RESPONSE',
      'Response eventId does not match request.',
    )
  }
  return response as CatalogSyncStatusResponse
}

export const sendCatalogSyncEvent = async (
  event: CatalogSyncEvent,
  options: CatalogSyncTransportOptions = {},
): Promise<CatalogSyncAcceptedResponse> => {
  validateCatalogSyncEvent(event)
  const env = assertCatalogSyncSendingEnabled(options.env)
  const apiKey = getAPIKey(env)
  const response = await request({
    apiKey,
    body: JSON.stringify(event),
    fetchImpl: options.fetchImpl || fetch,
    method: 'POST',
    timeoutMs: options.timeoutMs || defaultTimeoutMs,
    url: `${catalogSyncBaseURL}/api/catalog-sync/products`,
  })

  if (response.status !== 200 && response.status !== 202) {
    throw new CatalogSyncError(
      `CATALOG_SYNC_HTTP_${response.status}`,
      `Romanian catalog sync rejected the event with HTTP ${response.status}.`,
      { status: response.status },
    )
  }

  return requireResponseIdentity(
    await parseJSON(response),
    event.eventId,
  ) as CatalogSyncAcceptedResponse
}

export const sendCatalogSyncCommerceEvent = async (
  event: CatalogSyncCommerceEvent,
  options: CatalogSyncTransportOptions = {},
): Promise<CatalogSyncAcceptedResponse> => {
  validateCatalogSyncCommerceEvent(event)
  const env = assertCatalogSyncCommerceSendingEnabled(options.env)
  const apiKey = getAPIKey(env)
  const response = await request({
    apiKey,
    body: JSON.stringify(event),
    fetchImpl: options.fetchImpl || fetch,
    method: 'POST',
    timeoutMs: options.timeoutMs || defaultTimeoutMs,
    url: `${catalogSyncBaseURL}/api/catalog-sync/products`,
  })

  if (response.status !== 200 && response.status !== 202) {
    throw new CatalogSyncError(
      `CATALOG_SYNC_HTTP_${response.status}`,
      `Romanian catalog sync rejected the commerce event with HTTP ${response.status}.`,
      { status: response.status },
    )
  }

  return requireResponseIdentity(
    await parseJSON(response),
    event.eventId,
  ) as CatalogSyncAcceptedResponse
}

export const getCatalogSyncEventStatus = async (
  eventId: string,
  options: CatalogSyncTransportOptions = {},
): Promise<CatalogSyncStatusResponse> => {
  const env = resolveEnvironment(options.env)
  const apiKey = getAPIKey(env)
  const response = await request({
    apiKey,
    fetchImpl: options.fetchImpl || fetch,
    method: 'GET',
    timeoutMs: options.timeoutMs || defaultTimeoutMs,
    url: `${catalogSyncBaseURL}/api/catalog-sync/events/${encodeURIComponent(eventId)}`,
  })

  if (response.status !== 200) {
    throw new CatalogSyncError(
      `CATALOG_SYNC_HTTP_${response.status}`,
      `Romanian catalog sync status check failed with HTTP ${response.status}.`,
      { status: response.status },
    )
  }

  return requireResponseIdentity(await parseJSON(response), eventId) as CatalogSyncStatusResponse
}
