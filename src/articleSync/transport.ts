import { ArticleError, parseArticleEvent, type ArticleEvent } from './contract'

export type RemoteStatus = {
  eventId: string
  status: 'queued' | 'translating' | 'succeeded' | 'failed' | 'superseded' | 'unknown'
  error?: string | null
  warnings?: string[]
  postId?: string | null
}
export async function articleRequest(
  eventId: string,
  event?: ArticleEvent,
  fetchImpl = fetch,
): Promise<RemoteStatus> {
  if (process.env.ARTICLE_SYNC_SEND_ENABLED !== 'true')
    throw new ArticleError('Изпращането на статии е изключено.', 503)
  const key = process.env.CATALOG_SYNC_API_KEY
  if (!key) throw new ArticleError('Липсва сървърна конфигурация за изпращане.', 503)
  if (event) parseArticleEvent(event)
  let response: Response
  try {
    response = await fetchImpl(
      `https://ibis-electronics.ro/api/article-sync/${event ? 'articles' : `events/${encodeURIComponent(eventId)}`}`,
      {
        method: event ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: event ? JSON.stringify(event) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    )
  } catch {
    throw new ArticleError(
      'Неизвестен резултат от връзката с РО. Проверете статуса или повторете същото изпращане.',
      502,
    )
  }
  let body: any
  try {
    body = await response.json()
  } catch {
    throw new ArticleError('РО върна невалиден отговор.', 502)
  }
  if (!response.ok)
    throw new ArticleError(
      response.status === 404
        ? 'Събитието още не е намерено в РО. Можете да повторите изпращането.'
        : 'РО не прие заявката. Проверете конфигурацията и сървърния журнал.',
      502,
    )
  if (
    body?.eventId !== eventId ||
    !['queued', 'translating', 'succeeded', 'failed', 'superseded'].includes(body.status)
  )
    throw new ArticleError('РО върна несъответстващо събитие или статус.', 502)
  return {
    eventId,
    status: body.status,
    error: typeof body.error === 'string' ? body.error.slice(0, 2000) : null,
    warnings: Array.isArray(body.warnings)
      ? body.warnings.filter((w: any) => typeof w === 'string').slice(0, 500)
      : [],
    postId: typeof body.postId === 'string' ? body.postId : null,
  }
}
