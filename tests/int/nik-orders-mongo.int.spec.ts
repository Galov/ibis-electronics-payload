// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { nikOrderFields } from '@/services/nikOrders/fields'
import { createCheckoutOrderOnce } from '@/ecommerce/createCheckoutOrderOnce'
import { buildNikOrderRequest } from '@/services/nikOrders/contract'
import { sendNikOrder } from '@/services/nikOrders'

vi.mock('next/server', () => ({ after: vi.fn() }))

describe.skipIf(process.env.NIK_ORDER_TEST_DATABASE !== 'local')(
  'NIK sender isolated Mongo persistence',
  () => {
    let payload: Payload
    beforeAll(async () => {
      vi.stubEnv('NIK_ORDERS_SEND_ENABLED', 'true')
      vi.stubEnv('NIK_ORDERS_API_KEY', 'test-only')
      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          throw new Error('Network forbidden')
        }),
      )
      payload = await getPayload({
        config: buildConfig({
          secret: 'isolated-test-only',
          db: mongooseAdapter({ url: 'mongodb://127.0.0.1:27029/ibis_nik_sender_test' }),
          collections: [
            {
              slug: 'orders',
              fields: [
                { name: 'checkoutTransactionId', type: 'text', unique: true },
                { name: 'status', type: 'text' },
                {
                  name: 'transactions',
                  type: 'relationship',
                  relationTo: 'transactions',
                  hasMany: true,
                },
                ...nikOrderFields,
              ],
            },
            {
              slug: 'transactions',
              fields: [
                { name: 'status', type: 'text' },
                { name: 'paymentMethod', type: 'text' },
                { name: 'order', type: 'relationship', relationTo: 'orders' },
              ],
            },
          ],
        }),
      })
      await payload.db.collections.orders.init()
      // Only this hard-coded loopback fixture database is cleared.
      await payload.db.collections.orders.deleteMany({})
      await payload.db.collections.transactions.deleteMany({})
    }, 60000)
    afterAll(async () => {
      await payload?.destroy()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })

    it('creates one order for simultaneous confirmation and claims one HTTP send', async () => {
      const transaction = await payload.create({
        collection: 'transactions',
        data: { status: 'succeeded', paymentMethod: 'manual' },
      })
      const req = await createLocalReq({}, payload)
      const args = { status: 'processing' as const, transactions: [transaction.id] }
      const [a, b] = await Promise.all([
        createCheckoutOrderOnce(req, transaction.id, args),
        createCheckoutOrderOnce(await createLocalReq({}, payload), transaction.id, args),
      ])
      expect(a.id).toBe(b.id)
      expect((await payload.count({ collection: 'orders' })).totalDocs).toBe(1)
      await payload.update({
        collection: 'transactions',
        id: transaction.id,
        data: { order: a.id },
      })
      const request = buildNikOrderRequest(a.id, [{ productSKU: 'TEST', quantity: 1 }])
      await payload.update({
        collection: 'orders',
        id: a.id,
        data: { nikOrder: { status: 'pending', request } },
      })
      const fetchMock = vi.fn(async () =>
        Response.json({
          acceptanceStatus: 'accepted',
          externalOrderId: request.externalOrderId,
          orderId: 'nik-test',
          replayed: false,
          microinvestExport: { status: 'sent' },
          ibisStockSync: { status: 'sent' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)
      await Promise.all([sendNikOrder(payload, a.id), sendNikOrder(payload, a.id)])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect((await payload.findByID({ collection: 'orders', id: a.id })).nikOrder).toMatchObject({
        status: 'accepted',
        request,
        remoteOrderId: 'nik-test',
      })
      await sendNikOrder(payload, a.id)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('allows historical orders without the new checkout identity', async () => {
      await payload.create({ collection: 'orders', data: { status: 'processing' } })
      await payload.create({ collection: 'orders', data: { status: 'processing' } })
    })
  },
)
