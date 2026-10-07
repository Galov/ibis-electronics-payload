import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { buildMerchantInput, merchantProductKey } from '@/merchant/productInput'
import { MerchantClient } from '@/merchant/client'
import { syncMerchantProduct, queueMerchantProduct } from '@/merchant/tasks'
import { queueMerchantReconciliation } from '@/merchant/endpoint'

const product = {
  id: 'a123',
  title: 'Termostat',
  slug: 'termostat',
  published: true,
  price: 131.83,
  stockQty: 2,
  description: '<p>Descriere &amp; detalii</p>',
  images: [{ image: { id: 'm1', url: 'https://images.example.ro/a.jpg' } }],
  brand: { id: 'b1', title: 'Bosch' },
  manufacturerCode: 'ABC-123',
}

afterEach(() => vi.unstubAllEnvs())
describe('Merchant product mapping', () => {
  it('uses retail EUR, stable IDs, real identifiers and no guessed delivery/GTIN', () => {
    const mapped = buildMerchantInput(product as any).input!
    expect(mapped.productAttributes.price).toEqual({
      amountMicros: '131830000',
      currencyCode: 'EUR',
    })
    expect(mapped.offerId).toBe('ibis-bg-a123')
    expect(mapped.contentLanguage).toBe('bg')
    expect(mapped.productAttributes).toMatchObject({
      description: 'Descriere & detalii',
      brand: 'Bosch',
      mpn: 'ABC-123',
    })
    expect(mapped.productAttributes).not.toHaveProperty('gtins')
    expect(mapped.productAttributes).not.toHaveProperty('shipping')
    expect(mapped.productAttributes).not.toHaveProperty('identifierExists')
    expect(mapped.productAttributes).not.toHaveProperty('condition')
  })
  it.each([
    { published: false },
    { _status: 'draft' },
    { stockQty: 0 },
    { price: NaN },
    { price: 0 },
    { images: [] },
    { description: '', shortDescription: '' },
    { images: [{ image: { url: 'http://insecure.example/a.jpg' } }] },
  ])('skips ineligible %j', (patch) => {
    expect(buildMerchantInput({ ...product, ...patch } as any).input).toBeUndefined()
  })
  it('does not use SKU as MPN and does not change identity with SKU/slug changes', () => {
    const input = buildMerchantInput({
      ...product,
      manufacturerCode: null,
      sku: 'NOT-MPN',
      slug: 'other',
    } as any).input!
    expect(input.offerId).toBe('ibis-bg-a123')
    expect(input.productAttributes).not.toHaveProperty('mpn')
  })
})

function mockRequest(existing?: any, doc: any = product) {
  const payload = {
    find: vi.fn(async ({ collection }) => ({
      docs: collection === 'products' ? (doc ? [doc] : []) : existing ? [existing] : [],
    })),
    create: vi.fn(async ({ data }) => ({ id: 'entry', ...data })),
    update: vi.fn(async ({ data }) => ({ ...existing, id: 'entry', ...data })),
    jobs: { queue: vi.fn(async () => ({ id: 'job' })) },
  }
  return { req: { payload } as unknown as PayloadRequest, payload }
}
describe('durable Merchant synchronization', () => {
  it('checks unchanged listings without resending and refreshes after seven days', async () => {
    vi.stubEnv('MERCHANT_SYNC_ENABLED', 'true')
    const inputHash = createHash('sha256')
      .update(JSON.stringify(buildMerchantInput(product as any).input))
      .digest('hex')
    for (const [age, expected] of [
      [1, 0],
      [8, 1],
    ]) {
      const { req } = mockRequest({
        id: 'entry',
        status: 'sent',
        inputHash,
        lastSentAt: new Date(Date.now() - age * 86400_000).toISOString(),
      })
      const client = {
        insert: vi.fn(),
        remove: vi.fn(),
        status: vi.fn(async () => ({ productStatus: { destinationStatuses: [] } })),
      }
      await syncMerchantProduct('a123', req, client as any)
      expect(client.insert).toHaveBeenCalledTimes(expected)
      expect(client.status).toHaveBeenCalledTimes(1)
    }
  })
  it('records an API error and throws so the queue can retry it', async () => {
    vi.stubEnv('MERCHANT_SYNC_ENABLED', 'true')
    const { req, payload } = mockRequest({ id: 'entry' })
    const client = {
      insert: vi.fn(async () => {
        throw new Error('transient network failure')
      }),
      remove: vi.fn(),
      status: vi.fn(),
    }
    await expect(syncMerchantProduct('a123', req, client as any)).rejects.toThrow(
      'transient network failure',
    )
    expect(payload.update.mock.calls[0][0]).toMatchObject({ data: { status: 'failed' } })
  })
  it('is disabled by default', async () => {
    vi.stubEnv('MERCHANT_SYNC_ENABLED', 'false')
    const { req, payload } = mockRequest()
    expect(await syncMerchantProduct('a123', req)).toBe('disabled')
    await queueMerchantProduct('a123', req)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })
  it('sends once, records acknowledgement and accepts processing 404', async () => {
    vi.stubEnv('MERCHANT_SYNC_ENABLED', 'true')
    const { req, payload } = mockRequest()
    const client = { insert: vi.fn(), remove: vi.fn(), status: vi.fn(async () => null) }
    expect(await syncMerchantProduct('a123', req, client as any)).toBe('sent')
    expect(client.insert).toHaveBeenCalledTimes(1)
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(payload.create.mock.calls[0][0]).toMatchObject({ req, data: { status: 'sent' } })
  })
  it('withdraws deleted products, without modifying product collection', async () => {
    vi.stubEnv('MERCHANT_SYNC_ENABLED', 'true')
    const { req, payload } = mockRequest(
      { id: 'entry', lastSentAt: new Date().toISOString() },
      null,
    )
    const client = { insert: vi.fn(), remove: vi.fn(), status: vi.fn() }
    await syncMerchantProduct('a123', req, client as any)
    expect(client.remove).toHaveBeenCalledWith('a123')
    expect(client.insert).not.toHaveBeenCalled()
    expect(payload.update.mock.calls[0][0]).toMatchObject({
      collection: 'merchant-sync-entries',
      data: { status: 'removed' },
    })
  })
  it('does not withdraw if the database fails', async () => {
    vi.stubEnv('MERCHANT_SYNC_ENABLED', 'true')
    const { req, payload } = mockRequest({ id: 'entry' })
    payload.find.mockImplementation(async ({ collection }) => {
      if (collection === 'products') throw new Error('database unavailable')
      return { docs: [{ id: 'entry' }] }
    })
    const client = { insert: vi.fn(), remove: vi.fn(), status: vi.fn() }
    await expect(syncMerchantProduct('a123', req, client as any)).rejects.toThrow(
      'database unavailable',
    )
    expect(client.remove).not.toHaveBeenCalled()
    expect(payload.update.mock.calls[0][0]).toMatchObject({ data: { status: 'failed' } })
  })
  it('protects the backfill endpoint', async () => {
    const { req, payload } = mockRequest()
    const response = await queueMerchantReconciliation(req)
    expect(response.status).toBe(403)
    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })
})

describe('Merchant authenticated transport', () => {
  it('caches tokens and scopes inserts/deletes to BG and the selected source', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    vi.stubEnv(
      'MERCHANT_SERVICE_ACCOUNT_JSON',
      JSON.stringify({
        client_email: 'merchant-bg@ibis-merchant-integration.iam.gserviceaccount.com',
        project_id: 'ibis-merchant-integration',
        private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      }),
    )
    const transport = vi.fn(
      async (url: any) =>
        new Response(
          JSON.stringify(
            String(url).includes('oauth2') ? { access_token: 'test-token', expires_in: 3600 } : {},
          ),
          { status: 200 },
        ),
    )
    const client = new MerchantClient(transport)
    await client.insert(buildMerchantInput(product as any).input!)
    await client.remove('a123')
    expect(transport).toHaveBeenCalledTimes(3)
    expect(String(transport.mock.calls[1][0])).toContain(
      'products/v1/accounts/173890950/productInputs:insert',
    )
    expect(String(transport.mock.calls[1][0])).toContain('10757705357')
    expect(String(transport.mock.calls[2][0])).toContain(
      Buffer.from(merchantProductKey('a123')).toString('base64url'),
    )
  })
  it('rejects RO/setup credentials before making requests', async () => {
    vi.stubEnv(
      'MERCHANT_SERVICE_ACCOUNT_JSON',
      JSON.stringify({
        client_email: 'merchant-ro@example.com',
        project_id: 'ibis-merchant-integration',
        private_key: 'x',
      }),
    )
    const transport = vi.fn()
    await expect(new MerchantClient(transport).source()).rejects.toThrow('българската интеграция')
    expect(transport).not.toHaveBeenCalled()
  })
})
