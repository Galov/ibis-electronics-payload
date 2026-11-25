const uri = new URL(process.env.DATABASE_URL || 'invalid:')
if (
  process.env.IBIS_EN_RELEASE_REHEARSAL !== 'true' ||
  uri.hostname !== '127.0.0.1' ||
  uri.port !== '27028' ||
  uri.pathname !== '/ibis_en_release_rehearsal'
)
  throw Error('Unsafe rehearsal process')
const originalFetch = globalThis.fetch
// All server HTTP traffic stays on loopback, including the fake payment service.
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw Error('External HTTP blocked in local rehearsal')
  return originalFetch(input, init)
}
