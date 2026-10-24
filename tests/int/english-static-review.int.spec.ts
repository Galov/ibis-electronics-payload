// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import {
  reviewProduct,
  productHTML,
  catalogueHTML,
  englishText,
  imageURL,
  imageBase,
  rootCategories,
  type ReviewProduct,
} from '../../scripts/review/catalog'
import { buildReview, productProjection } from '../../scripts/review/build.mjs'
import { reviewServer, authorized } from '../../scripts/review/serve.mjs'
const id = 'abcdef012345abcdef012345'
const p: ReviewProduct = {
  id,
  title: 'Test <script>alert(1)</script>',
  description: 'Description <img src=x onerror=alert(1)>',
  summary: '',
  seoTitle: 'SEO title',
  seoDescription: 'SEO description',
  sku: 'AB123',
  originalSku: '00123',
  manufacturerCode: '',
  brand: 'Brand',
  categories: [],
  images: [],
  price: 12.34,
}
const servers: any[] = [],
  folders: string[] = []
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((resolve) => s.close(() => resolve()))
  for (const f of folders.splice(0)) await fs.rm(f, { recursive: true, force: true })
})
describe('isolated English static review', () => {
  it('never substitutes BG or exports administrative fields', () => {
    expect(englishText({ bg: 'PRIVATE BG SENTINEL' })).toBe('')
    expect(
      reviewProduct(
        { _id: id, title: { bg: 'PRIVATE BG SENTINEL' } },
        new Map(),
        new Map(),
        new Map(),
      ),
    ).toBeNull()
    const dto = reviewProduct(
      {
        _id: id,
        title: { bg: 'PRIVATE BG SENTINEL', en: 'English name' },
        description: { bg: 'BG PRIVATE', en: 'Description' },
        email: 'private@example.test',
        sourcePrice: 1,
        catalogSync: { secret: 'PRIVATE' },
        images: [{ alt: 'BG PRIVATE', legacyUrl: 'javascript:alert(1)' }],
      },
      new Map(),
      new Map(),
      new Map(),
    )!
    expect(JSON.stringify(dto)).not.toMatch(/PRIVATE|email|catalogSync|sourcePrice/)
    expect(dto.title).toBe('English name')
    expect(dto.images).toEqual([])
    expect(Object.keys(productProjection)).not.toContain('catalogSync')
  })
  it('rejects configuration overrides before a database connection can open', async () => {
    await expect(buildReview(['--database=mongodb+srv://production'])).rejects.toThrow(
      'no database or output overrides',
    )
  })
  it('resolves only safe public images and keeps the uploaded image preference', () => {
    const media = new Map([['one', { filename: 'New image.jpg' }]])
    expect(imageURL({ image: 'one', storageKey: 'legacy.jpg' }, media)).toBe(
      imageBase + '/New%20image.jpg',
    )
    expect(imageURL({ legacyUrl: 'https://evil.example/tracker' }, new Map())).toBe('')
    expect(imageURL({ storageKey: '../secret' }, new Map())).toBe('')
  })
  it('escapes product text and includes no transactional routes or forms', () => {
    const html = productHTML(p, new Map(), '2026-10-24')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toMatch(/<form|href="[^" ]*(?:checkout|cart|login|account)|action=/i)
    expect(html).toContain('noindex,nofollow')
    expect(html).toContain('lang="en"')
    expect(catalogueHTML([p], [], 1, '2026-10-24')).toContain(`/en/products/${id}/`)
  })
  it('traverses category parents safely and never emits a BG fallback', () => {
    const map = new Map([
      ['child', { _id: 'child', title: 'Подкатегория', parent: 'root' }],
      ['root', { _id: 'root', title: 'Перални', parent: null }],
    ])
    expect(rootCategories(['child'], map)).toEqual(['root'])
    expect(rootCategories(['missing'], map)).toEqual([])
  })
  it('serves static files, blocks writes, traversal and missing commerce paths', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibis-review-'))
    folders.push(dir)
    await fs.writeFile(path.join(dir, 'index.html'), '<h1>Static review</h1>')
    await fs.writeFile(path.join(dir, '_headers'), 'private config')
    const server = reviewServer({ directory: dir })
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const response = await fetch(base)
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Static review')
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(response.headers.get('content-security-policy')).toContain("form-action 'none'")
    expect((await fetch(base, { method: 'POST', body: 'no write' })).status).toBe(405)
    expect((await fetch(base + '/_headers')).status).toBe(404)
    expect((await fetch(base + '/en/checkout/')).status).toBe(404)
    expect((await fetch(base + '/%2e%2e%2f.env')).status).toBe(404)
    await fs.symlink(path.join(dir, '_headers'), path.join(dir, 'link.html'))
    // Inside-root generated assets are readable; outside-root symlinks are not.
    await fs.symlink(path.join(os.tmpdir(), 'outside-review.html'), path.join(dir, 'outside.html'))
    expect((await fetch(base + '/outside.html')).status).toBe(404)
  })
  it('can protect every local resource with server-side credentials', async () => {
    expect(authorized(undefined, 'ibis', 'secret')).toBe(false)
    expect(
      authorized('Basic ' + Buffer.from('ibis:wrong').toString('base64'), 'ibis', 'secret'),
    ).toBe(false)
    expect(
      authorized('Basic ' + Buffer.from('ibis:secret').toString('base64'), 'ibis', 'secret'),
    ).toBe(true)
    const server = reviewServer({ directory: os.tmpdir(), password: 'secret' })
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/assets/catalogue.json`,
    )
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('Ibis product review')
  })
})
