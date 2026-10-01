// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { buildArticleEvent, type Article } from '@/articleSync/contract'
import { articleRequest } from '@/articleSync/transport'
import { prepareArticle, recordArticleStatus, sendArticle } from '@/articleSync/endpoints'
import { loadArticle } from '@/articleSync/source'

vi.mock('@/articleSync/source', () => ({ loadArticle: vi.fn() }))
const article: Article = {
  sourceArticleId: '000000000000000000000001',
  title: 'Статия',
  excerpt: 'Резюме',
  content: {
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Текст', format: 1 }] }],
    },
  },
  seoTitle: null,
  seoDescription: null,
  seoImage: null,
  featuredImage: null,
  sourcePublishedAt: '2026-09-20T10:00:00.000Z',
  categories: [],
  relatedPosts: [],
  media: [],
  links: [],
}
const event = buildArticleEvent(article, 1, '2026-10-01T10:00:00.000Z')
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
describe('BG article sender', () => {
  beforeEach(() => {
    vi.stubEnv('ARTICLE_SYNC_SEND_ENABLED', 'true')
    vi.stubEnv('CATALOG_SYNC_API_KEY', 'fixture-key')
  })
  it('sends only server-side with bearer authentication and rejects redirects', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ eventId: event.eventId, status: 'queued' }, { status: 202 }),
    )
    expect(await articleRequest(event.eventId, event, fetcher)).toMatchObject({ status: 'queued' })
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://ibis-electronics.ro/api/article-sync/articles')
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer fixture-key' },
      body: JSON.stringify(event),
    })
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })
  it('reports uncertain network outcomes without exposing provider errors', async () => {
    await expect(
      articleRequest(
        event.eventId,
        event,
        vi.fn().mockRejectedValue(new Error('secret fixture-key')),
      ),
    ).rejects.toThrow('Неизвестен резултат')
  })
  it('rejects mismatched event IDs and unsupported statuses', async () => {
    for (const body of [
      { eventId: 'wrong', status: 'queued' },
      { eventId: event.eventId, status: 'accepted' },
    ])
      await expect(
        articleRequest(event.eventId, event, vi.fn().mockResolvedValue(Response.json(body))),
      ).rejects.toThrow('несъответстващо')
  })
  it('does not access the network while disabled', async () => {
    vi.stubEnv('ARTICLE_SYNC_SEND_ENABLED', 'false')
    const fetcher = vi.fn()
    await expect(articleRequest(event.eventId, event, fetcher)).rejects.toThrow('изключено')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('requires an authenticated administrator', async () => {
    const response = await sendArticle({ user: null } as PayloadRequest)
    expect(response.status).toBe(401)
  })
  it('reuses immutable events, advances A→B→A, and ignores late status responses', async () => {
    let stored: any = null
    const db = {
      beginTransaction: vi.fn(async () => 'test-transaction'),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    }
    const payload = {
      db,
      find: vi.fn(async (args: any) => ({
        docs:
          stored && (!args.where.eventId || args.where.eventId.equals === stored.eventId)
            ? [structuredClone(stored)]
            : [],
      })),
      create: vi.fn(
        async ({ data }: any) => (stored = { id: 'outgoing', ...structuredClone(data) }),
      ),
      update: vi.fn(async ({ data }: any) => (stored = { ...stored, ...structuredClone(data) })),
    }
    const req = { payload } as unknown as PayloadRequest
    vi.mocked(loadArticle).mockResolvedValue({ article, updatedAt: '2026-10-01T10:00:00.000Z' })
    const first = await prepareArticle(article.sourceArticleId, req)
    expect(await prepareArticle(article.sourceArticleId, req)).toEqual(first)
    vi.mocked(loadArticle).mockResolvedValue({
      article: { ...article, title: 'Друго' },
      updatedAt: '2026-10-01T11:00:00.000Z',
    })
    const second = await prepareArticle(article.sourceArticleId, req)
    vi.mocked(loadArticle).mockResolvedValue({ article, updatedAt: '2026-10-01T12:00:00.000Z' })
    const third = await prepareArticle(article.sourceArticleId, req)
    expect([first.sourceRevision, second.sourceRevision, third.sourceRevision]).toEqual([1, 2, 3])
    expect(third.eventId).not.toBe(first.eventId)
    await recordArticleStatus({ eventId: first.eventId, status: 'failed' }, req)
    expect(stored.status).toBe('sending')
    await recordArticleStatus({ eventId: third.eventId, status: 'succeeded' }, req)
    await recordArticleStatus({ eventId: third.eventId, status: 'queued' }, req)
    expect(stored.status).toBe('succeeded')
    for (const [args] of [...payload.create.mock.calls, ...payload.update.mock.calls])
      expect((args as any).req.transactionID).toBe('test-transaction')
  })
})
