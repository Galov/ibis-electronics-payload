// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { buildNikOrderRequest, postNikOrder } from '@/services/nikOrders/contract'
import { queueNikOrder, sendNikOrder } from '@/services/nikOrders'
import { nikOrderRetry } from '@/endpoints/nik-order-retry'

const callbacks = vi.hoisted(() => [] as (() => Promise<void>)[])
vi.mock('next/server', () => ({
  after: (callback: () => Promise<void>) => callbacks.push(callback),
}))

const request = buildNikOrderRequest('order1', [{ productSKU: 'SKU-1', quantity: 2 }])
let order: any
let transaction: any
let payload: Payload
let network: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('NIK_ORDERS_SEND_ENABLED', 'true')
  vi.stubEnv('NIK_ORDERS_API_KEY', 'test-only')
  callbacks.length = 0
  order = {
    id: 'order1',
    status: 'processing',
    items: [{ productSKU: 'SKU-1', quantity: 2 }],
    transactions: ['tx1'],
    nikOrder: { status: 'pending', request },
  }
  transaction = { id: 'tx1', order: 'order1', paymentMethod: 'manual', status: 'succeeded' }
  network = vi.fn(async () =>
    Response.json(
      {
        acceptanceStatus: 'accepted',
        externalOrderId: request.externalOrderId,
        orderId: 'nik1',
        replayed: false,
        microinvestExport: { status: 'sent' },
        ibisStockSync: { status: 'sent' },
      },
      { status: 201 },
    ),
  )
  vi.stubGlobal('fetch', network)
  payload = {
    logger: { error: vi.fn() },
    findByID: vi.fn(async ({ collection }: any) =>
      structuredClone(collection === 'orders' ? order : transaction),
    ),
    db: {
      updateOne: vi.fn(async ({ where, data }: any) => {
        for (const condition of where.and) {
          const [path, predicate] = Object.entries(condition)[0] as [string, any]
          const value = path.split('.').reduce((obj: any, part: string) => obj?.[part], order)
          if ('equals' in predicate && value !== predicate.equals) return null
          if ('exists' in predicate && (value !== undefined && value !== null) !== predicate.exists)
            return null
        }
        order = { ...order, ...structuredClone(data) }
        return structuredClone(order)
      }),
    },
  } as unknown as Payload
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BG orders to NIK', () => {
  it('sends only the stable ID, SKU and aggregated quantities, never customer data or prices', () => {
    expect(
      buildNikOrderRequest('abc', [
        { productSKU: 'A', quantity: 1 },
        { productSKU: 'A', quantity: 2 },
      ]),
    ).toEqual({ externalOrderId: 'BG:abc', items: [{ sku: 'A', quantity: 3 }] })
  })
  it.each([0, -1, 0.5, NaN, 1000001])('rejects invalid quantity %s', (quantity) => {
    expect(() => buildNikOrderRequest('abc', [{ productSKU: 'A', quantity }])).toThrow(
      'INVALID_QUANTITY',
    )
  })
  it('rejects missing SKU instead of looking up a potentially edited product', () => {
    expect(() => buildNikOrderRequest('abc', [{ quantity: 1 }])).toThrow('INVALID_SKU')
  })
  it('does not touch the database or network when disabled', async () => {
    vi.stubEnv('NIK_ORDERS_SEND_ENABLED', 'false')
    await queueNikOrder({ payload } as PayloadRequest, order)
    await expect(sendNikOrder(payload, order.id)).rejects.toThrow('NIK_ORDERS_SEND_DISABLED')
    expect(payload.db.updateOne).not.toHaveBeenCalled()
    expect(payload.findByID).not.toHaveBeenCalled()
    expect(network).not.toHaveBeenCalled()
  })
  it('persists the immutable request and sends only in the after-response callback', async () => {
    delete order.nikOrder
    await queueNikOrder({ payload } as PayloadRequest, structuredClone(order))
    expect(order.nikOrder.request).toEqual(request)
    expect(network).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(1)
    await callbacks[0]()
    expect(order.nikOrder.status).toBe('accepted')
    expect(network).toHaveBeenCalledTimes(1)
  })
  it.each(['manual', 'revolut'])(
    'sends a confirmed %s order and does not resend accepted orders',
    async (method) => {
      transaction.paymentMethod = method
      await sendNikOrder(payload, order.id)
      await sendNikOrder(payload, order.id)
      expect(order.nikOrder.remoteOrderId).toBe('nik1')
      expect(network).toHaveBeenCalledTimes(1)
      expect(order.items).toEqual([{ productSKU: 'SKU-1', quantity: 2 }])
    },
  )
  it('does not send pending or failed payment', async () => {
    for (const status of ['pending', 'failed']) {
      transaction.status = status
      await expect(sendNikOrder(payload, order.id)).rejects.toThrow('PAYMENT_NOT_CONFIRMED')
    }
    expect(network).not.toHaveBeenCalled()
  })
  it('deduplicates concurrent delivery claims', async () => {
    await Promise.all([sendNikOrder(payload, order.id), sendNikOrder(payload, order.id)])
    expect(network).toHaveBeenCalledTimes(1)
  })
  it('records shortage for manual handling without cancelling or refunding the BG order', async () => {
    network.mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'INSUFFICIENT_STOCK',
            details: [{ sku: 'SKU-1', requested: 2, available: 1 }],
          },
        },
        { status: 409 },
      ),
    )
    await sendNikOrder(payload, order.id)
    expect(order.nikOrder.status).toBe('manual_review')
    expect(order.nikOrder.details).toEqual([{ sku: 'SKU-1', requested: 2, available: 1 }])
    expect(order.status).toBe('processing')
    expect(transaction.status).toBe('succeeded')
    await sendNikOrder(payload, order.id)
    expect(network).toHaveBeenCalledTimes(1)
  })
  it('retains the exact request after timeout even if order items were edited', async () => {
    network.mockRejectedValueOnce(new Error('timeout'))
    await sendNikOrder(payload, order.id)
    expect(order.nikOrder.status).toBe('unknown')
    order.items[0].quantity = 99
    await sendNikOrder(payload, order.id, {
      actor: 'admin',
      reason: 'Retry lost response',
      expectedAttemptId: order.nikOrder.attemptId,
    })
    expect(network.mock.calls.map((call: any) => JSON.parse(call[1].body))).toEqual([
      request,
      request,
    ])
    expect(order.nikOrder.status).toBe('accepted')
  })
  it('rejects stale recovery controls and active sends', async () => {
    order.nikOrder.attemptId = 'current'
    order.nikOrder.status = 'sending'
    order.nikOrder.lastAttemptAt = new Date().toISOString()
    await expect(
      sendNikOrder(payload, order.id, {
        actor: 'admin',
        reason: 'Retry',
        expectedAttemptId: 'old',
      }),
    ).rejects.toThrow('STALE_ATTEMPT')
    await expect(
      sendNikOrder(payload, order.id, {
        actor: 'admin',
        reason: 'Retry',
        expectedAttemptId: 'current',
      }),
    ).rejects.toThrow('SEND_IN_PROGRESS')
    expect(network).not.toHaveBeenCalled()
  })
  it('safely resumes an interrupted send using the same event', async () => {
    order.nikOrder.status = 'sending'
    order.nikOrder.attemptId = 'interrupted'
    order.nikOrder.lastAttemptAt = new Date(Date.now() - 180000).toISOString()
    await sendNikOrder(payload, order.id, {
      actor: 'admin',
      reason: 'Resume',
      expectedAttemptId: 'interrupted',
    })
    expect(JSON.parse(network.mock.calls[0][1].body)).toEqual(request)
    expect(order.nikOrder.status).toBe('accepted')
  })
  it('rejects anonymous recovery requests', async () => {
    expect((await nikOrderRetry({} as PayloadRequest)).status).toBe(403)
    expect(network).not.toHaveBeenCalled()
  })
  it('does not confuse failed MI export with rejection of the NIK order', async () => {
    network.mockResolvedValue(
      Response.json({
        acceptanceStatus: 'accepted',
        externalOrderId: request.externalOrderId,
        orderId: 'nik1',
        replayed: true,
        microinvestExport: { status: 'unknown' },
        ibisStockSync: { status: 'failed' },
      }),
    )
    expect(await postNikOrder(request)).toMatchObject({
      status: 'accepted',
      microinvestStatus: 'unknown',
      stockSyncStatus: 'failed',
    })
  })
  it('does not accept mismatched success responses or disclose upstream bodies', async () => {
    network.mockResolvedValue(
      Response.json({
        acceptanceStatus: 'accepted',
        externalOrderId: 'wrong',
        orderId: 'nik1',
        replayed: true,
      }),
    )
    expect(await postNikOrder(request)).toEqual({ status: 'unknown', code: 'INVALID_NIK_RESPONSE' })
    network.mockResolvedValue(new Response('private upstream details', { status: 500 }))
    expect(await postNikOrder(request)).toEqual({
      status: 'unknown',
      code: 'NIK_RESPONSE_UNCONFIRMED',
    })
  })
})
