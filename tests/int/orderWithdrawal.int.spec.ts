// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest'
import type { PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { createWithdrawalToken, verifyWithdrawalToken } from '@/orderWithdrawal/token'
import { canCancelImmediately, recordWithdrawal } from '@/orderWithdrawal/service'
import { requestWithdrawalLink, submitWithdrawal } from '@/orderWithdrawal/endpoints'
import { boxNowCreateShipmentHandler } from '@/endpoints/boxnow-order-shipment'

const id = '6a95adf4ec73a01c378fb4e4'
const email = 'client@example.bg'
const secret = 'test-only-secret'
const makeOrder = (changes: Partial<Order> = {}) =>
  ({
    id,
    customerEmail: email,
    status: 'processing',
    transactions: ['tx1'],
    nikOrder: { status: 'pending' },
    ...changes,
  }) as Order
const makeRequest = (body: unknown, order = makeOrder(), user: unknown = null) =>
  ({
    url: 'http://localhost:3000/api/order-withdrawal/submit',
    headers: new Headers({ origin: 'http://localhost:3000', 'x-real-ip': id }),
    user,
    json: async () => body,
    payload: {
      secret,
      logger: { error: vi.fn() },
      sendEmail: vi.fn(),
      find: vi.fn(async () => ({ docs: [order] })),
      findByID: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'transactions'
          ? { id: 'tx1', order: id, status: 'succeeded', paymentMethod: 'manual' }
          : order,
      ),
      db: {
        beginTransaction: vi.fn(async () => 'tx'),
        commitTransaction: vi.fn(async () => {}),
        rollbackTransaction: vi.fn(async () => {}),
        updateOne: vi.fn(async () => order),
      },
      jobs: { queue: vi.fn() },
    },
  }) as unknown as PayloadRequest

afterEach(() => vi.unstubAllEnvs())

describe('withdrawal proof and ownership', () => {
  it('blocks both mutations during a local preview of the production database', async () => {
    vi.stubEnv('IBIS_LOCAL_PREVIEW', 'true')
    const req = makeRequest({ confirmed: true, token: createWithdrawalToken(id, email, secret) })
    expect((await submitWithdrawal(req)).status).toBe(503)
    expect((await requestWithdrawalLink(req)).status).toBe(503)
    expect(req.payload.db.updateOne).not.toHaveBeenCalled()
    expect(req.payload.sendEmail).not.toHaveBeenCalled()
  })
  it('rejects tampered, expired and unrelated-purpose tokens', () => {
    const token = createWithdrawalToken(id, email, secret, 0)
    expect(verifyWithdrawalToken(token, secret, 1)?.orderID).toBe(id)
    expect(verifyWithdrawalToken(token, secret, 86400_000)).toBeNull()
    expect(verifyWithdrawalToken(`${token}x`, secret, 1)).toBeNull()
    expect(verifyWithdrawalToken(token, 'other-secret', 1)).toBeNull()
  })
  it('requires a separate affirmative POST confirmation', async () => {
    const req = makeRequest({ token: createWithdrawalToken(id, email, secret) })
    expect((await submitWithdrawal(req)).status).toBe(400)
    expect(req.payload.db.updateOne).not.toHaveBeenCalled()
  })
  it('denies guest submissions without a signed proof, even with a known order ID', async () => {
    const req = makeRequest({ confirmed: true, orderID: id })
    expect((await submitWithdrawal(req)).status).toBe(403)
    expect(req.payload.find).not.toHaveBeenCalled()
  })
  it('enforces account access and explicit ownership before privileged access', async () => {
    const req = makeRequest({ confirmed: true, orderID: id }, makeOrder(), { id: 'owner' })
    vi.mocked(req.payload.find).mockResolvedValueOnce({ docs: [] } as any)
    expect((await submitWithdrawal(req)).status).toBe(403)
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        user: req.user,
        overrideAccess: false,
        where: { and: [{ id: { equals: id } }, { customer: { equals: 'owner' } }] },
      }),
    )
    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(req.payload.db.updateOne).not.toHaveBeenCalled()
  })
  it('uses the email in the signed proof to authorize exactly one order', async () => {
    const req = makeRequest({
      confirmed: true,
      token: createWithdrawalToken(id, email, secret),
      orderID: 'different',
    })
    expect((await submitWithdrawal(req)).status).toBe(200)
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { and: [{ id: { equals: id } }, { customerEmail: { equals: email } }] },
      }),
    )
  })
  it('rejects cross-origin authenticated requests', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://ibis-electronics.ro')
    const req = makeRequest({ confirmed: true, orderID: id }, makeOrder(), { id: 'owner' })
    req.headers.set('origin', 'https://unrelated.example')
    expect((await submitWithdrawal(req)).status).toBe(403)
    expect(req.payload.find).not.toHaveBeenCalled()
  })
  it('does not disclose whether a guest email matches an order', async () => {
    const req = makeRequest({ orderID: id, email })
    vi.mocked(req.payload.find).mockResolvedValue({ docs: [] } as any)
    expect(await (await requestWithdrawalLink(req)).json()).toEqual({ ok: true })
    expect(req.payload.sendEmail).not.toHaveBeenCalled()
  })
})

describe('withdrawal recording without stock changes', () => {
  it('blocks creating a BoxNow shipment for an order with a recorded withdrawal', async () => {
    const req = makeRequest({}, makeOrder({ deliveryMethod: 'boxnow', withdrawal: {
      requestedAt: '2026-10-13T12:00:00Z', status: 'pending',
    } }), { id: 'admin', roles: ['admin'] })
    req.routeParams = { id }
    expect((await boxNowCreateShipmentHandler(req)).status).toBe(409)
    expect(req.payload.db.updateOne).not.toHaveBeenCalled()
  })
  it.each(['accepted', 'sending', 'unknown', 'retryable', 'manual_review'] as const)(
    'requires Ibis handling when NIK state is %s',
    (status) => {
      expect(canCancelImmediately(makeOrder({ nikOrder: { status } }), 'manual')).toBe(false)
    },
  )
  it('requires Ibis handling for paid and completed orders', () => {
    expect(canCancelImmediately(makeOrder(), 'revolut')).toBe(false)
    expect(canCancelImmediately(makeOrder({ status: 'completed' }), 'manual')).toBe(false)
  })
  it('does not assume historical orders or existing shipments have not been dispatched', () => {
    expect(canCancelImmediately(makeOrder({ nikOrder: undefined }), 'manual')).toBe(false)
    expect(canCancelImmediately(makeOrder({ boxNowShipmentStatus: 'created' }), 'manual')).toBe(
      false,
    )
  })
  it('cancels a manual processing order atomically and queues a confirmation, without touching stock', async () => {
    const order = makeOrder()
    const req = makeRequest({}, order)
    expect(await recordWithdrawal(req, order, 'account')).toBe('cancelled')
    expect(req.payload.db.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        data: {
          status: 'cancelled',
          withdrawal: { source: 'account', status: 'cancelled', requestedAt: expect.any(String) },
        },
        req: expect.objectContaining({ transactionID: 'tx' }),
      }),
    )
    expect(req.payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { orderID: id },
        req: expect.objectContaining({ transactionID: 'tx' }),
      }),
    )
    expect(req.payload.db.commitTransaction).toHaveBeenCalledWith('tx')
    expect(
      vi
        .mocked(req.payload.db.updateOne)
        .mock.calls.every(([args]) => args.collection === 'orders'),
    ).toBe(true)
  })
  it('records an already dispatched order without changing its status', async () => {
    const order = makeOrder({ nikOrder: { status: 'accepted' } })
    const req = makeRequest({}, order)
    expect(await recordWithdrawal(req, order, 'email')).toBe('pending')
    expect(vi.mocked(req.payload.db.updateOne).mock.calls[0][0].data).not.toHaveProperty('status')
  })
  it('does not duplicate a previously recorded withdrawal', async () => {
    const order = makeOrder({
      withdrawal: { requestedAt: '2026-10-13T12:00:00Z', status: 'pending' },
    })
    const req = makeRequest({}, order)
    expect(await recordWithdrawal(req, order, 'email')).toBe('pending')
    expect(req.payload.db.updateOne).not.toHaveBeenCalled()
    expect(req.payload.jobs.queue).not.toHaveBeenCalled()
  })
  it('rolls back when an order changes concurrently, without queuing email', async () => {
    const req = makeRequest({})
    vi.mocked(req.payload.db.updateOne).mockResolvedValueOnce(null as any)
    expect(await recordWithdrawal(req, makeOrder(), 'account')).toBeNull()
    expect(req.payload.db.rollbackTransaction).toHaveBeenCalledWith('tx')
    expect(req.payload.jobs.queue).not.toHaveBeenCalled()
  })
  it('rolls back the withdrawal if durable notification queuing fails', async () => {
    const req = makeRequest({})
    vi.mocked(req.payload.jobs.queue).mockRejectedValueOnce(new Error('queue unavailable'))
    await expect(recordWithdrawal(req, makeOrder(), 'account')).rejects.toThrow('queue unavailable')
    expect(req.payload.db.commitTransaction).not.toHaveBeenCalled()
    expect(req.payload.db.rollbackTransaction).toHaveBeenCalledWith('tx')
  })
})
