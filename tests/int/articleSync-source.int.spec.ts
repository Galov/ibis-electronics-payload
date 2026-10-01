// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { loadArticle } from '@/articleSync/source'
const post = {
  id: '000000000000000000000001',
  title: 'Статия',
  excerpt: 'Резюме',
  content: { root: { type: 'root', children: [] } },
  _status: 'published',
  updatedAt: '2026-10-01T10:00:00.000Z',
  publishedAt: '2026-09-20T10:00:00.000Z',
}
describe('published BG source', () => {
  it('reads the published version with administrator access checks, not its newer draft', async () => {
    const findByID = vi.fn(async () => post)
    const user = { id: 'admin', roles: ['admin'] }
    const req = { user, payload: { findByID } } as unknown as PayloadRequest
    const result = await loadArticle(post.id, req)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ draft: false, overrideAccess: false, user, req, depth: 0 }),
    )
    expect(result.article.sourcePublishedAt).toBe(post.publishedAt)
  })
  it('refuses an unpublished article before calling any translator or transport', async () => {
    const req = {
      payload: { findByID: vi.fn(async () => ({ ...post, _status: 'draft' })) },
    } as unknown as PayloadRequest
    await expect(loadArticle(post.id, req)).rejects.toThrow('Първо публикувайте')
  })
})
