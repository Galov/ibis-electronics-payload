import type { PayloadHandler, PayloadRequest } from 'payload'
import { checkRole } from '@/access/utilities'
import {
  ArticleError,
  buildArticleEvent,
  hash,
  parseArticleEvent,
  type ArticleEvent,
} from './contract'
import { loadArticle } from './source'
import { articleRequest, type RemoteStatus } from './transport'

async function transaction<T>(req: PayloadRequest, fn: (tx: PayloadRequest) => Promise<T>) {
  const transactionID = await req.payload.db.beginTransaction()
  if (!transactionID) throw new ArticleError('Необходима е транзакционна база.', 503)
  const tx = { ...req, transactionID } as PayloadRequest
  try {
    const result = await fn(tx)
    await req.payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID).catch(() => {})
    throw error
  }
}
export async function prepareArticle(
  sourceArticleId: string,
  req: PayloadRequest,
): Promise<ArticleEvent> {
  return transaction(req, async (tx) => {
    const { article, updatedAt } = await loadArticle(sourceArticleId, tx)
    const found = await tx.payload.find({
      collection: 'article-sync-outgoing',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req: tx,
      where: { sourceArticleId: { equals: sourceArticleId } },
    })
    const previous = found.docs[0]
    const old = previous ? parseArticleEvent(previous.payload) : null
    if (old?.sourceContentHash === hash(article)) return old
    const event = buildArticleEvent(article, (previous?.revision || 0) + 1, updatedAt)
    const data = {
      sourceArticleId,
      revision: event.sourceRevision,
      eventId: event.eventId,
      payload: event as any,
      status: 'sending' as const,
      error: null,
      warnings: [],
      postId: null,
    }
    if (previous)
      await tx.payload.update({
        collection: 'article-sync-outgoing',
        id: previous.id,
        overrideAccess: true,
        req: tx,
        data,
      })
    else
      await tx.payload.create({
        collection: 'article-sync-outgoing',
        overrideAccess: true,
        req: tx,
        data,
      })
    return event
  })
}
export async function recordArticleStatus(status: RemoteStatus, req: PayloadRequest) {
  return transaction(req, async (tx) => {
    const found = await tx.payload.find({
      collection: 'article-sync-outgoing',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req: tx,
      where: { eventId: { equals: status.eventId } },
    })
    const record = found.docs[0]
    if (!record || ['succeeded', 'superseded'].includes(record.status)) return
    // The read + write are in one transaction, so a concurrent new source version
    // cannot be overwritten by this response to an older event.
    await tx.payload.update({
      collection: 'article-sync-outgoing',
      id: record.id,
      overrideAccess: true,
      req: tx,
      data: {
        status: status.status,
        error: status.error || null,
        warnings: status.warnings || [],
        postId: status.postId || null,
      },
    })
  })
}
const handler =
  (send: boolean): PayloadHandler =>
  async (req) => {
    if (!req.user || !checkRole(['admin'], req.user))
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    const id = req.routeParams?.id
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id))
      return Response.json({ message: 'Невалидна статия.' }, { status: 400 })
    let event: ArticleEvent | null = null
    try {
      if (send) {
        if (process.env.ARTICLE_SYNC_SEND_ENABLED !== 'true')
          throw new ArticleError('Изпращането на статии е изключено.', 503)
        event = await prepareArticle(id, req)
      } else {
        const found = await req.payload.find({
          collection: 'article-sync-outgoing',
          depth: 0,
          limit: 1,
          overrideAccess: false,
          user: req.user,
          req,
          where: { sourceArticleId: { equals: id } },
        })
        if (!found.docs[0]) return Response.json({ status: 'never_sent' })
        event = parseArticleEvent(found.docs[0].payload)
      }
      const response = await articleRequest(event.eventId, send ? event : undefined)
      await recordArticleStatus(response, req)
      return Response.json(response)
    } catch (error) {
      req.payload.logger.error({ msg: 'BG article sync failed', err: error })
      const message =
        error instanceof ArticleError
          ? error.message
          : 'Изпращането не завърши. Проверете статуса и повторете при необходимост.'
      if (event)
        await recordArticleStatus(
          { eventId: event.eventId, status: 'unknown', error: message },
          req,
        ).catch(() => {})
      return Response.json(
        { message },
        { status: error instanceof ArticleError ? error.status : 503 },
      )
    }
  }
export const sendArticle = handler(true)
export const refreshArticle = handler(false)
