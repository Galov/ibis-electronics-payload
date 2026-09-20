import { validateRomaniaUpdate, type RomaniaUpdateEvent } from './contract'

export type UpdateEnvironment = {
  ROMANIA_UPDATES_SEND_ENABLED?: string
  CATALOG_SYNC_API_KEY?: string
}
const environment = (): UpdateEnvironment => ({
  ROMANIA_UPDATES_SEND_ENABLED: process.env.ROMANIA_UPDATES_SEND_ENABLED,
  CATALOG_SYNC_API_KEY: process.env.CATALOG_SYNC_API_KEY,
})
export const updatesEnabled = (env: UpdateEnvironment = environment()) =>
  env.ROMANIA_UPDATES_SEND_ENABLED === 'true'
export const assertUpdatesEnabled = (env: UpdateEnvironment = environment()) => {
  if (!updatesEnabled(env)) throw new Error('ROMANIA_UPDATES_SEND_DISABLED')
}
export type RemoteStatus = 'accepted' | 'succeeded' | 'superseded' | 'failed'
export type UpdateTransport = {
  send: (event: RomaniaUpdateEvent) => Promise<RemoteStatus>
  status: (eventId: string) => Promise<RemoteStatus>
}

export function updateTransport({
  env = environment(),
  fetchImpl = fetch,
  timeoutMs = 5000,
}: {
  env?: UpdateEnvironment
  fetchImpl?: typeof fetch
  timeoutMs?: number
} = {}): UpdateTransport {
  async function request(eventId: string, body?: RomaniaUpdateEvent): Promise<RemoteStatus> {
    assertUpdatesEnabled(env)
    if (!env.CATALOG_SYNC_API_KEY) throw new Error('ROMANIA_UPDATES_KEY_MISSING')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(
        `https://ibis-electronics.ro/api/catalog-sync/${body ? 'products' : `events/${encodeURIComponent(eventId)}`}`,
        {
          method: body ? 'POST' : 'GET',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${env.CATALOG_SYNC_API_KEY}`,
            'Content-Type': 'application/json',
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        },
      )
      if (![200, 202].includes(response.status))
        throw new Error(`ROMANIA_UPDATES_HTTP_${response.status}`)
      const data = (await response.json()) as { eventId?: unknown; status?: unknown }
      if (!data || data.eventId !== eventId || typeof data.status !== 'string')
        throw new Error('ROMANIA_UPDATES_INVALID_RESPONSE')
      if (
        ['queued', 'pending', 'processing', 'accepted', 'running', 'upserting'].includes(
          data.status,
        )
      )
        return 'accepted'
      if (['succeeded', 'superseded', 'failed'].includes(data.status))
        return data.status as RemoteStatus
      throw new Error('ROMANIA_UPDATES_INVALID_RESPONSE')
    } catch (error) {
      if (error instanceof Error && /^ROMANIA_UPDATES_[A-Z_0-9]+$/.test(error.message)) throw error
      throw new Error(
        controller.signal.aborted ? 'ROMANIA_UPDATES_TIMEOUT' : 'ROMANIA_UPDATES_NETWORK_ERROR',
      )
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    send: (event) => request(validateRomaniaUpdate(event).eventId, event),
    status: (eventId) => request(eventId),
  }
}
