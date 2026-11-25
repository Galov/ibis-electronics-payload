// Cloudflare Pages advanced mode: every route must pass through this handler.
const encoder = new TextEncoder()
const headers = {
  'Cache-Control': 'private, no-store',
  'Vary': 'Authorization',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://pub-622233fdc4f2482dbbcdc30b088f61ab.r2.dev https://ibis-electronics.com https://www.ibis-electronics.com; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
}
function reply(status, message, extra = {}) {
  return new Response(message, { status, headers: { ...headers, ...extra } })
}
async function valid(header, user, password) {
  if (!header || header.length > 8192 || !/^Basic /i.test(header)) return false
  let decoded
  try {
    const binary = atob(header.slice(6))
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)))
  } catch { return false }
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(decoded)),
    crypto.subtle.digest('SHA-256', encoder.encode(`${user}:${password}`)),
  ])
  // Cloudflare's constant-time WebCrypto extension; never fall back to string comparison.
  return crypto.subtle.timingSafeEqual(actual, expected)
}
export default {
  async fetch(request, env) {
    try {
      if (typeof env.REVIEW_USERNAME !== 'string' || !env.REVIEW_USERNAME.trim() ||
          env.REVIEW_USERNAME.includes(':') || typeof env.REVIEW_PASSWORD !== 'string' ||
          !env.REVIEW_PASSWORD.trim() || !env.ASSETS?.fetch) {
        return reply(503, 'Review access is not configured')
      }
      if (!await valid(request.headers.get('Authorization'), env.REVIEW_USERNAME, env.REVIEW_PASSWORD)) {
        return reply(401, 'Authentication required', {
          'WWW-Authenticate': 'Basic realm="Ibis product review", charset="UTF-8"',
        })
      }
      if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Read-only preview', { Allow: 'GET, HEAD' })
      // Credentials are never forwarded to the static asset service.
      const safeHeaders = new Headers(request.headers)
      safeHeaders.delete('Authorization')
      safeHeaders.delete('Cookie')
      const response = await env.ASSETS.fetch(new Request(request, { headers: safeHeaders }))
      const secured = new Response(response.body, response)
      for (const [key, value] of Object.entries(headers)) secured.headers.set(key, value)
      return secured
    } catch {
      // No origin fallback, request details, headers, or secrets in logs.
      return reply(503, 'Review temporarily unavailable')
    }
  },
}
