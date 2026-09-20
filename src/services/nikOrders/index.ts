import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import type { Payload, PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { buildNikOrderRequest, postNikOrder, type NikOrderRequest } from './contract'

async function prepareNikRequest(payload: Payload, order: Order, req?: PayloadRequest) {
  if (
    !order.nikOrder?.request &&
    (!order.nikOrder?.status || order.nikOrder.status === 'pending')
  ) {
    let request: NikOrderRequest | undefined
    let code = ''
    try {
      request = buildNikOrderRequest(order.id, order.items || [])
    } catch (error) {
      code = error instanceof Error ? error.message : 'INVALID_ORDER'
    }
    await payload.db.updateOne({
      collection: 'orders',
      req,
      where: {
        and: [
          { id: { equals: order.id } },
          order.nikOrder?.status
            ? { 'nikOrder.status': { equals: 'pending' } }
            : { 'nikOrder.status': { exists: false } },
          { 'nikOrder.request': { exists: false } },
        ],
      },
      data: {
        nikOrder: { status: request ? 'pending' : 'manual_review', request, lastCode: code },
      },
    })
  }
}

export async function queueNikOrder(req: PayloadRequest, order: Order) {
  if (process.env.NIK_ORDERS_SEND_ENABLED !== 'true') return
  try {
    await prepareNikRequest(req.payload, order, req)
  } catch {
    req.payload.logger.error({ msg: 'NIK request preparation needs review', orderId: order.id })
  }
  after(async () => {
    try {
      await sendNikOrder(req.payload, order.id)
    } catch {
      req.payload.logger.error({ msg: 'NIK order dispatch needs review', orderId: order.id })
    }
  })
}

export async function sendNikOrder(
  payload: Payload,
  id: string,
  retry?: { actor: string; reason: string; expectedAttemptId: string | null },
) {
  if (process.env.NIK_ORDERS_SEND_ENABLED !== 'true') throw new Error('NIK_ORDERS_SEND_DISABLED')
  let order = await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true })
  if (order.nikOrder?.status === 'pending' && !order.nikOrder.request) {
    await prepareNikRequest(payload, order)
    order = await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true })
  }
  const state = order.nikOrder
  if (!state?.request || !state.status || state.status === 'accepted') return
  if (order.status === 'cancelled' || order.status === 'refunded')
    throw new Error('ORDER_NOT_ELIGIBLE')
  const transactionID = order.transactions?.[0]
  if (!transactionID) throw new Error('TRANSACTION_MISSING')
  const transaction = await payload.findByID({
    collection: 'transactions',
    id: typeof transactionID === 'string' ? transactionID : transactionID.id,
    depth: 0,
    overrideAccess: true,
  })
  if (
    transaction.status !== 'succeeded' ||
    !['manual', 'revolut'].includes(transaction.paymentMethod || '')
  )
    throw new Error('PAYMENT_NOT_CONFIRMED')
  const transactionOrder =
    typeof transaction.order === 'object' ? transaction.order?.id : transaction.order
  if (transactionOrder !== id) throw new Error('TRANSACTION_ORDER_MISMATCH')
  if (!retry && state.status !== 'pending') return
  if (retry && (state.attemptId || null) !== retry.expectedAttemptId)
    throw new Error('STALE_ATTEMPT')
  if (
    state.status === 'sending' &&
    (!state.lastAttemptAt || Date.now() - Date.parse(state.lastAttemptAt) < 120000)
  )
    throw new Error('SEND_IN_PROGRESS')
  const body = state.request as NikOrderRequest
  // Never rebuild a possibly accepted request from subsequently edited products/order rows.
  const validated = buildNikOrderRequest(
    id,
    body.items.map((item) => ({ productSKU: item.sku, quantity: item.quantity })),
  )
  if (
    body.externalOrderId !== validated.externalOrderId ||
    JSON.stringify(body) !== JSON.stringify(validated)
  )
    throw new Error('INVALID_SAVED_REQUEST')
  const attemptId = randomUUID()
  const claimed = await payload.db.updateOne({
    collection: 'orders',
    where: {
      and: [
        { id: { equals: id } },
        { 'nikOrder.status': { equals: state.status } },
        state.attemptId
          ? { 'nikOrder.attemptId': { equals: state.attemptId } }
          : { 'nikOrder.attemptId': { exists: false } },
      ],
    },
    data: {
      nikOrder: {
        ...state,
        status: 'sending',
        attemptId,
        lastAttemptAt: new Date().toISOString(),
        ...(retry ? { retryBy: retry.actor, retryReason: retry.reason } : {}),
      },
    },
  })
  if (!claimed) return
  const result = await postNikOrder(body)
  await payload.db.updateOne({
    collection: 'orders',
    where: {
      and: [
        { id: { equals: id } },
        { 'nikOrder.attemptId': { equals: attemptId } },
        { 'nikOrder.status': { equals: 'sending' } },
      ],
    },
    data: {
      nikOrder: {
        ...(claimed as unknown as Order).nikOrder,
        status: result.status,
        lastCode: result.code,
        details: result.details || [],
        remoteOrderId: result.orderId || null,
        acceptedAt: result.status === 'accepted' ? new Date().toISOString() : null,
        microinvestStatus: result.microinvestStatus || null,
        stockSyncStatus: result.stockSyncStatus || null,
      },
    },
  })
}
