import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import type { Product } from '@/payload-types'
import { buildRomaniaUpdate, validateRomaniaUpdate } from '@/services/romaniaUpdates/contract'
import { applyNikUpdateAndForward, deliverRomaniaUpdate } from '@/services/romaniaUpdates'
import { updateTransport } from '@/services/romaniaUpdates/transport'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const sample = (kind: 'price' | 'stock' = 'stock', revision = 1, value = 3) =>
  buildRomaniaUpdate({
    kind,
    revision,
    value,
    productId: 'bg-1',
    updatedAt: '2026-09-20T10:00:00.000Z',
  })
describe('separate strict price/stock contracts', () => {
  it('sends only the stock quantity or final EUR price, never content or the other lane', () => {
    expect(sample().product).toEqual({ sourceProductId: 'bg-1', stockQty: 3 })
    expect(sample('price').product).toEqual({ sourceProductId: 'bg-1', sourcePriceEUR: 3 })
    expect(validateRomaniaUpdate(sample())).toEqual(sample())
  })
  it('retries exact versions and gives A -> B -> A a new identity', () => {
    expect(sample().eventId).toBe(sample().eventId)
    expect(sample('stock', 3, 3).eventId).not.toBe(sample('stock', 1, 3).eventId)
    expect(sample('stock', 2, 4).eventId).not.toBe(sample().eventId)
    expect(sample('price').eventId).not.toBe(sample().eventId)
  })
  it.each(['description', 'title', 'stockStatus', 'sourcePriceEUR', 'published', 'images'])(
    'rejects extra stock field %s',
    (field) => {
      const event = sample()
      expect(() =>
        validateRomaniaUpdate({ ...event, product: { ...event.product, [field]: 10 } }),
      ).toThrow()
    },
  )
  it('rejects extra envelope fields and a changed quantity under the old ID', () => {
    expect(() => validateRomaniaUpdate({ ...sample(), secret: 'no' })).toThrow()
    expect(() =>
      validateRomaniaUpdate({ ...sample(), product: { sourceProductId: 'bg-1', stockQty: 2 } }),
    ).toThrow()
  })
  it.each([-1, NaN, Infinity])('rejects invalid quantities %s', (value) =>
    expect(() => sample('stock', 1, value)).toThrow(),
  )
})

describe('guarded RO transport', () => {
  it('does no HTTP with the separate guard off even if content sending is enabled', async () => {
    vi.stubEnv('CATALOG_SYNC_SEND_ENABLED', 'true')
    const fetchImpl = vi.fn()
    const transport = updateTransport({ env: { CATALOG_SYNC_API_KEY: 'secret' }, fetchImpl })
    await expect(transport.send(sample())).rejects.toThrow('ROMANIA_UPDATES_SEND_DISABLED')
    await expect(transport.status(sample().eventId)).rejects.toThrow(
      'ROMANIA_UPDATES_SEND_DISABLED',
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('rejects wrong acknowledgement IDs and does not leak response bodies', async () => {
    const env = { ROMANIA_UPDATES_SEND_ENABLED: 'true', CATALOG_SYNC_API_KEY: 'secret' }
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ eventId: 'wrong', status: 'succeeded' })))
    await expect(updateTransport({ env, fetchImpl }).send(sample())).rejects.toThrow(
      'ROMANIA_UPDATES_INVALID_RESPONSE',
    )
    fetchImpl.mockResolvedValue(new Response('secret and private text', { status: 500 }))
    await expect(updateTransport({ env, fetchImpl }).send(sample())).rejects.toThrow(
      'ROMANIA_UPDATES_HTTP_500',
    )
  })
  it('sends to a fixed host with redirect protection, and treats 202 as accepted', async () => {
    const event = sample()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ eventId: event.eventId, status: 'queued' }), { status: 202 }),
      )
    await expect(
      updateTransport({
        env: { ROMANIA_UPDATES_SEND_ENABLED: 'true', CATALOG_SYNC_API_KEY: 'secret' },
        fetchImpl,
      }).send(event),
    ).resolves.toBe('accepted')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://ibis-electronics.ro/api/catalog-sync/products',
      expect.objectContaining({ redirect: 'error', method: 'POST', body: JSON.stringify(event) }),
    )
  })
})

function fixture(approved = true) {
  vi.stubEnv('ROMANIA_UPDATES_SEND_ENABLED', 'true')
  vi.stubEnv('CATALOG_SYNC_API_KEY', 'secret')
  let product = {
    id: 'bg-1',
    price: 11.5,
    sourcePrice: 10,
    stockQty: 4,
    description: 'Months of editorial work',
    title: 'Original',
    updatedAt: '2026-09-20T10:00:00.000Z',
    catalogSync: approved ? { lastSuccessfulEventId: 'content-1' } : {},
  } as Product
  type Stored = {
    id: string
    key: string
    eventId: string
    status: string
    revision: number
    kind: string
    event: unknown
    lastErrorCode?: string
  }
  let streams: Stored[] = []
  let backup: { product: Product; streams: Stored[] }
  const order: string[] = []
  const payload = {
    db: {
      beginTransaction: vi.fn(async () => {
        order.push('begin')
        backup = structuredClone({ product, streams })
        return 'tx'
      }),
      commitTransaction: vi.fn(async () => {
        order.push('commit')
      }),
      rollbackTransaction: vi.fn(async () => {
        order.push('rollback')
        product = backup.product
        streams = backup.streams
      }),
    },
    find: vi.fn(async ({ where }) => ({
      docs: structuredClone(streams.filter((row) => row.key === where.key.equals)),
    })),
    findByID: vi.fn(async ({ collection, id }) =>
      structuredClone(collection === 'products' ? product : streams.find((row) => row.id === id)),
    ),
    create: vi.fn(async ({ data, req }) => {
      expect(req.transactionID).toBe('tx')
      const row = { id: `row-${streams.length}`, ...data }
      streams.push(row)
      return structuredClone(row)
    }),
    update: vi.fn(async ({ id, where, data, req }) => {
      if (id) expect(req.transactionID).toBe('tx')
      const row = streams.find((row) =>
        id
          ? row.id === id
          : row.id === where.and[0].id.equals &&
            row.eventId === where.and[1].eventId.equals &&
            !['succeeded', 'superseded'].includes(row.status),
      )
      if (row) Object.assign(row, data)
      return structuredClone(row)
    }),
    logger: { error: vi.fn() },
  }
  const fetchImpl = vi.fn(async (_url: unknown, args: RequestInit) => {
    expect(order.at(-1)).toBe('commit')
    const event = JSON.parse(String(args.body))
    order.push('http')
    return new Response(JSON.stringify({ eventId: event.eventId, status: 'succeeded' }))
  })
  // Two lanes may send concurrently, but both must observe the same committed transaction.
  fetchImpl.mockImplementation(async (_url, args) => {
    expect(order).toContain('commit')
    expect(order.lastIndexOf('commit')).toBeGreaterThan(order.lastIndexOf('begin'))
    const event = JSON.parse(String(args.body))
    order.push('http')
    return new Response(JSON.stringify({ eventId: event.eventId, status: 'succeeded' }))
  })
  vi.stubGlobal('fetch', fetchImpl)
  const req = { payload } as unknown as PayloadRequest
  const apply = async (patch: Partial<Product>, stockProvided = true) =>
    applyNikUpdateAndForward({
      req,
      productId: product.id,
      stockProvided,
      update: async (request) => {
        expect(request.transactionID).toBe('tx')
        product = { ...product, ...patch }
        return structuredClone(product)
      },
    })
  return { payload, req, apply, fetchImpl, order, streams: () => streams, product: () => product }
}

describe('NIK commit and durable independent lanes', () => {
  it('leaves the old path untouched while disabled', async () => {
    vi.stubEnv('ROMANIA_UPDATES_SEND_ENABLED', 'false')
    const req = {} as PayloadRequest
    const update = vi.fn(async () => ({ id: 'bg-1' }) as Product)
    await applyNikUpdateAndForward({ req, productId: 'bg-1', stockProvided: true, update })
    expect(update).toHaveBeenCalledWith(req)
  })
  it('forwards zero stock only after commit and preserves editorial content', async () => {
    const f = fixture()
    await f.apply({ stockQty: 0 })
    expect(f.fetchImpl).toHaveBeenCalledTimes(1)
    expect(f.streams()[0].event).toMatchObject({
      eventType: 'product.stock_updated',
      product: { sourceProductId: 'bg-1', stockQty: 0 },
    })
    expect(f.streams()[0].status).toBe('succeeded')
    expect(f.product().description).toBe('Months of editorial work')
    expect(f.product().price).toBe(11.5)
    expect(f.order.indexOf('http')).toBeGreaterThan(f.order.indexOf('commit'))
  })
  it('uses the marked-up BG retail price, not the NIK source price', async () => {
    const f = fixture()
    await f.apply({ sourcePrice: 20, price: 23 }, false)
    expect(f.streams()).toHaveLength(1)
    expect(f.streams()[0].event).toMatchObject({
      product: { sourceProductId: 'bg-1', sourcePriceEUR: 23 },
    })
    expect(JSON.stringify(f.streams()[0].event)).not.toMatch(/stockQty|description|title/)
  })
  it('separates both changes and assigns independent revisions', async () => {
    const f = fixture()
    await f.apply({ price: 23, stockQty: 3 })
    expect(f.streams()).toHaveLength(2)
    expect(f.streams().map((row) => row.revision)).toEqual([1, 1])
    expect(f.fetchImpl).toHaveBeenCalledTimes(2)
  })
  it('does not create events for unchanged values or products never manually sent', async () => {
    const f = fixture()
    await f.apply({ stockQty: 4, price: 11.5 })
    expect(f.fetchImpl).not.toHaveBeenCalled()
    const unapproved = fixture(false)
    await unapproved.apply({ stockQty: 0, price: 23 })
    expect(unapproved.fetchImpl).not.toHaveBeenCalled()
    expect(unapproved.streams()).toEqual([])
  })
  it('persists failure without undoing BG and retries the exact event on the next NIK update', async () => {
    const f = fixture()
    f.fetchImpl.mockRejectedValue(new Error('contains secret'))
    await f.apply({ stockQty: 0 })
    expect(f.product().stockQty).toBe(0)
    const originalEvent = structuredClone(f.streams()[0].event)
    expect(f.streams()[0]).toMatchObject({
      status: 'failed',
      lastErrorCode: 'ROMANIA_UPDATES_NETWORK_ERROR',
    })
    f.fetchImpl.mockImplementation(
      async (_url, args) =>
        new Response(
          JSON.stringify({ eventId: JSON.parse(String(args.body)).eventId, status: 'succeeded' }),
        ),
    )
    await f.apply({ stockQty: 0 })
    expect(f.streams()[0].event).toEqual(originalEvent)
    expect(f.streams()[0].status).toBe('succeeded')
  })
  it('versions A -> B -> A even when document timestamps happen to match', async () => {
    const f = fixture()
    await f.apply({ stockQty: 3 })
    const first = f.streams()[0].eventId
    await f.apply({ stockQty: 2 })
    await f.apply({ stockQty: 3 })
    expect(f.streams()[0].revision).toBe(3)
    expect(f.streams()[0].eventId).not.toBe(first)
  })
  it('rolls back the BG write if durable recording fails, without HTTP', async () => {
    const f = fixture()
    f.payload.create.mockRejectedValue(new Error('database unavailable'))
    await expect(f.apply({ stockQty: 0 })).rejects.toThrow()
    expect(f.product().stockQty).toBe(4)
    expect(f.fetchImpl).not.toHaveBeenCalled()
    expect(f.payload.db.rollbackTransaction).toHaveBeenCalled()
  })
  it('tracks asynchronous failure and reuses the same event for an explicit retry', async () => {
    const f = fixture()
    f.fetchImpl.mockImplementation(
      async (_url, args) =>
        new Response(
          JSON.stringify({ eventId: JSON.parse(String(args.body)).eventId, status: 'queued' }),
          { status: 202 },
        ),
    )
    await f.apply({ stockQty: 0 })
    const stream = f.streams()[0]
    expect(stream.status).toBe('accepted')
    const transport = {
      send: vi.fn(async () => 'succeeded' as const),
      status: vi.fn(async () => 'failed' as const),
    }
    await deliverRomaniaUpdate({
      payload: f.payload as unknown as Payload,
      id: stream.id,
      transport,
    })
    expect(f.streams()[0].status).toBe('failed')
    expect(transport.send).not.toHaveBeenCalled()
    await deliverRomaniaUpdate({
      payload: f.payload as unknown as Payload,
      id: stream.id,
      transport,
    })
    expect(transport.send).toHaveBeenCalledWith(stream.event)
    expect(f.streams()[0].status).toBe('succeeded')
  })
  it('does not overwrite a newer revision with a late delivery response', async () => {
    const f = fixture()
    f.fetchImpl.mockRejectedValue(new Error('offline'))
    await f.apply({ stockQty: 0 })
    const stream = f.streams()[0]
    await deliverRomaniaUpdate({
      payload: f.payload as unknown as Payload,
      id: stream.id,
      transport: {
        status: vi.fn(),
        send: async () => {
          stream.eventId = 'newer-event'
          stream.revision++
          stream.status = 'pending'
          return 'succeeded'
        },
      },
    })
    expect(stream.status).toBe('pending')
    expect(stream.eventId).toBe('newer-event')
  })

  it('does not resend a successfully delivered value on a duplicate NIK update', async () => {
    const f = fixture()
    await f.apply({ stockQty: 0 })
    await f.apply({ stockQty: 0 })
    expect(f.fetchImpl).toHaveBeenCalledTimes(1)
    expect(f.streams()[0].revision).toBe(1)
  })

  it('retries a transaction conflict before doing any external delivery', async () => {
    const f = fixture()
    f.payload.create.mockRejectedValueOnce(
      Object.assign(new Error('write conflict'), { code: 112 }),
    )
    await f.apply({ stockQty: 0 })
    expect(f.payload.db.beginTransaction).toHaveBeenCalledTimes(2)
    expect(f.payload.db.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(f.fetchImpl).toHaveBeenCalledTimes(1)
    expect(f.streams()[0].revision).toBe(1)
  })

  it('does not deliver if the product transaction fails to commit', async () => {
    const f = fixture()
    f.payload.db.commitTransaction.mockRejectedValueOnce(new Error('commit failed'))
    await expect(f.apply({ stockQty: 0 })).rejects.toThrow('commit failed')
    expect(f.fetchImpl).not.toHaveBeenCalled()
    expect(f.product().stockQty).toBe(4)
    expect(f.streams()).toEqual([])
  })

  it('never sends an old journal value after the BG quantity has moved on', async () => {
    const f = fixture()
    f.fetchImpl.mockRejectedValue(new Error('offline'))
    await f.apply({ stockQty: 0 })
    f.product().stockQty = 9
    const transport = { send: vi.fn(), status: vi.fn() }
    await deliverRomaniaUpdate({
      payload: f.payload as unknown as Payload,
      id: f.streams()[0].id,
      transport,
    })
    expect(transport.send).not.toHaveBeenCalled()
    expect(f.streams()[0].status).toBe('superseded')
    expect(f.product().stockQty).toBe(9)
  })

  it('does not replace an already confirmed result with a late failure for the same event', async () => {
    const f = fixture()
    f.fetchImpl.mockRejectedValue(new Error('offline'))
    await f.apply({ stockQty: 0 })
    const row = f.streams()[0]
    await deliverRomaniaUpdate({
      payload: f.payload as unknown as Payload,
      id: row.id,
      transport: {
        status: vi.fn(),
        send: async () => {
          row.status = 'succeeded'
          throw new Error('late timeout')
        },
      },
    })
    expect(row.status).toBe('succeeded')
  })
})
