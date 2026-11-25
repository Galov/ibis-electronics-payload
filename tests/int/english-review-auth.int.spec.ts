// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { webcrypto, timingSafeEqual } from 'node:crypto'
import worker from '../../scripts/review/cloudflare/worker.mjs'
// Node adapter for Cloudflare's WebCrypto extension. No external requests.
const runtimeCrypto = {
  subtle: {
    digest: webcrypto.subtle.digest.bind(webcrypto.subtle),
    timingSafeEqual: (a: ArrayBuffer, b: ArrayBuffer) => timingSafeEqual(Buffer.from(a), Buffer.from(b)),
  },
}
beforeAll(() => vi.stubGlobal('crypto', runtimeCrypto))
afterAll(() => vi.unstubAllGlobals())
const credentials = { REVIEW_USERNAME: 'reviewer', REVIEW_PASSWORD: 'test-only:парола' }
const authorization = 'Basic ' + Buffer.from(`${credentials.REVIEW_USERNAME}:${credentials.REVIEW_PASSWORD}`).toString('base64')
function setup() {
  const fetch = vi.fn(async () => new Response('protected content'))
  return { ...credentials, ASSETS: { fetch } }
}
function req(url: string, auth?: string, method = 'GET') {
  return new Request('https://preview.example' + url, { method, headers: auth ? { Authorization: auth, Cookie: 'private=value' } : {} })
}
describe('English review server-side protection', () => {
  it.each(['/', '/en/', '/en/products/123/', '/assets/catalogue.json', '/assets/review.js', '/robots.txt', '/review-manifest.json', '/missing'])('protects %s before accessing assets', async url => {
    const env = setup()
    for (const auth of [undefined, 'Basic broken!', 'Bearer token', 'Basic ' + btoa('wrong:password')]) {
      const response = await worker.fetch(req(url, auth), env)
      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toContain('Basic')
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    }
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })
  it.each(['REVIEW_USERNAME', 'REVIEW_PASSWORD', 'ASSETS'])('fails closed without %s', async key => {
    const env = { ...setup(), [key]: undefined }
    expect((await worker.fetch(req('/en/', authorization), env)).status).toBe(503)
  })
  it('allows correct UTF-8 credentials and strips secrets before asset access', async () => {
    const env = setup()
    const response = await worker.fetch(req('/assets/catalogue.json', authorization), env)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('protected content')
    const passed = env.ASSETS.fetch.mock.calls[0] as unknown as [Request]
    expect(passed[0].headers.has('Authorization')).toBe(false)
    expect(passed[0].headers.has('Cookie')).toBe(false)
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
  })
  it('allows HEAD, rejects writes, and fails closed on asset errors', async () => {
    const env = setup()
    expect((await worker.fetch(req('/en/', authorization, 'HEAD'), env)).status).toBe(200)
    env.ASSETS.fetch.mockClear()
    expect((await worker.fetch(req('/en/', authorization, 'POST'), env)).status).toBe(405)
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
    env.ASSETS.fetch.mockRejectedValueOnce(Error('private details'))
    const response = await worker.fetch(req('/en/', authorization), env)
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private details')
  })
})
