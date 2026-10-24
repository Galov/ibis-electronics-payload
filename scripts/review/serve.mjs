// Standalone static file server. This process has no database/API dependencies.
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, timingSafeEqual } from 'node:crypto'
const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.local-notes/english-products-review/site',
)
const csp =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://pub-622233fdc4f2482dbbcdc30b088f61ab.r2.dev https://ibis-electronics.com https://www.ibis-electronics.com; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
}
export function authorized(header, user, password) {
  if (!password) return true
  const expected = Buffer.from(`${user}:${password}`).toString('base64')
  const hash = (s) => createHash('sha256').update(s).digest()
  return typeof header === 'string' && timingSafeEqual(hash(header), hash(`Basic ${expected}`))
}
export function reviewServer({ directory: base = directory, user = 'ibis', password = '' } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', csp)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (!authorized(req.headers.authorization, user, password)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Ibis product review", charset="UTF-8"',
      })
      res.end('Authentication required')
      return
    }
    if (!['GET', 'HEAD'].includes(req.method || '')) {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end('Read-only preview')
      return
    }
    try {
      const name = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)
      if (
        name.includes('\\') ||
        name.includes('\0') ||
        name.split('/').some((p) => p.startsWith('.') || p === '_headers')
      )
        throw Error('Invalid path')
      let file = path.resolve(base, '.' + name)
      if (!file.startsWith(base + path.sep) && file !== base) throw Error('Invalid path')
      const stat = await fs.stat(file)
      if (stat.isDirectory()) file = path.join(file, 'index.html')
      const actual = await fs.realpath(file),
        realBase = await fs.realpath(base)
      if (!actual.startsWith(realBase + path.sep)) throw Error('Invalid path')
      const type = types[path.extname(file)]
      if (!type) throw Error('Unsupported file')
      const data = await fs.readFile(file)
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length })
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Product preview page not found')
    }
  })
}
export async function main(argv = process.argv.slice(2)) {
  if (argv.length && !(argv.length === 2 && argv[0] === '--port'))
    throw Error('Usage: npm run review:products:serve -- [--port 3118]')
  const port = Number(argv[1] || 3118)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port')
  await fs.access(path.join(directory, 'review-manifest.json'))
  const server = reviewServer({
    password: process.env.REVIEW_PASSWORD || '',
    user: process.env.REVIEW_USERNAME || 'ibis',
  })
  server.on('error', (e) => {
    console.error('Local preview stopped:', e.message)
    process.exitCode = 1
  })
  server.listen(port, '127.0.0.1', () =>
    console.log(`English product review: http://127.0.0.1:${port}/en/ (local files only)`),
  )
  return server
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error('Local preview stopped:', e.message)
    process.exitCode = 1
  })
