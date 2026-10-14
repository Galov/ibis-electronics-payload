import type { Order } from '@/payload-types'
import type { PayloadRequest, Where } from 'payload'

export function canCancelImmediately(
  order: Pick<Order, 'status' | 'nikOrder' | 'boxNowShipmentStatus' | 'boxNowShipmentCreatedAt'>,
  paymentMethod?: string | null,
) {
  return (
    order.status === 'processing' &&
    paymentMethod === 'manual' &&
    order.nikOrder?.status === 'pending' &&
    order.boxNowShipmentStatus !== 'created' &&
    !order.boxNowShipmentCreatedAt
  )
}

// Compare the current state atomically with the state used to decide the outcome.
// The only business records written here are orders; no stock or refund API is called.
export async function recordWithdrawal(
  req: PayloadRequest,
  order: Order,
  source: 'account' | 'email',
) {
  if (order.withdrawal?.requestedAt) return order.withdrawal.status
  if (order.status === 'cancelled' || order.status === 'refunded') return 'cancelled'
  const transactionID = await req.payload.db.beginTransaction()
  if (!transactionID) throw new Error('TRANSACTION_REQUIRED')
  const tx = { ...req, transactionID } as PayloadRequest
  try {
    const transactionRef = order.transactions?.[0]
    const transaction = transactionRef
      ? await req.payload.findByID({
          collection: 'transactions',
          id: typeof transactionRef === 'string' ? transactionRef : transactionRef.id,
          depth: 0,
          overrideAccess: true,
          req: tx,
        })
      : null
    const transactionOrder =
      typeof transaction?.order === 'object' ? transaction.order?.id : transaction?.order
    const paymentMethod =
      transactionOrder === order.id && transaction?.status === 'succeeded'
        ? transaction.paymentMethod
        : null
    const immediate = canCancelImmediately(order, paymentMethod)
    const compare = (path: string, value: unknown): Where =>
      value == null ? { [path]: { exists: false } } : { [path]: { equals: value } }
    const result = await req.payload.db.updateOne({
      collection: 'orders',
      req: tx,
      where: {
        and: [
          { id: { equals: order.id } },
          { 'withdrawal.requestedAt': { exists: false } },
          compare('status', order.status),
          compare('nikOrder.status', order.nikOrder?.status),
          compare('boxNowShipmentStatus', order.boxNowShipmentStatus),
          compare('boxNowShipmentCreatedAt', order.boxNowShipmentCreatedAt),
        ],
      },
      data: {
        ...(immediate ? { status: 'cancelled' } : {}),
        withdrawal: {
          requestedAt: new Date().toISOString(),
          source,
          status: immediate ? 'cancelled' : 'pending',
        },
      },
    })
    if (!result) {
      await req.payload.db.rollbackTransaction(transactionID)
      return null
    }
    await req.payload.jobs.queue({
      task: 'notifyOrderWithdrawal',
      queue: 'order-withdrawal',
      input: { orderID: order.id },
      req: tx,
    })
    await req.payload.db.commitTransaction(transactionID)
    return immediate ? 'cancelled' : 'pending'
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID).catch(() => {})
    throw error
  }
}
