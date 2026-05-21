import type { Order, Transaction } from '@/payload-types'

import type { PayloadHandler, PayloadRequest } from 'payload'

import { checkRole } from '@/access/utilities'
import { createBoxNowDeliveryRequest, downloadBoxNowParcelLabel } from '@/utilities/boxNow'

type BoxNowOrderParcelInput = {
  boxNowParcelId?: string | null
  compartmentSize?: number | null
  description?: string | null
  id?: string | null
  weight?: number | null
}

type BoxNowShipmentOrder = Pick<
  Order,
  | 'amount'
  | 'boxNowDeliveryRequestId'
  | 'boxNowLockerId'
  | 'boxNowLockerName'
  | 'createdAt'
  | 'customerEmail'
  | 'deliveryMethod'
  | 'id'
  | 'items'
  | 'shippingAddress'
  | 'transactions'
> & {
  boxNowParcels?: BoxNowOrderParcelInput[] | null
}

type ShipmentRequestBody = {
  parcels?: BoxNowOrderParcelInput[]
}

const ORDERS_COLLECTION = 'orders'
const TRANSACTIONS_COLLECTION = 'transactions'
const BOXNOW_ORIGIN_LOCATION_ID = '2'

class EndpointError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const jsonError = (message: string, status: number) => Response.json({ message }, { status })

const ensureAdmin = (req: PayloadRequest) => {
  if (!req.user || !checkRole(['admin'], req.user)) {
    return jsonError('Unauthorized', 401)
  }

  return null
}

const parseMoney = (value?: null | number) => {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return amount.toFixed(2)
}

const splitAmountAcrossParcels = (amount: number, count: number) => {
  if (count <= 0) return []

  const totalCents = Math.max(0, Math.round(amount * 100))
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count

  return Array.from({ length: count }, (_, index) => {
    const cents = base + (index < remainder ? 1 : 0)
    return (cents / 100).toFixed(2)
  })
}

const sanitizeParcels = (parcels?: BoxNowOrderParcelInput[] | null) => {
  return (Array.isArray(parcels) ? parcels : [])
    .map((parcel, index) => {
      const weight = typeof parcel.weight === 'number' ? parcel.weight : Number(parcel.weight)
      const compartmentSize =
        typeof parcel.compartmentSize === 'number'
          ? parcel.compartmentSize
          : Number(parcel.compartmentSize)
      const description = typeof parcel.description === 'string' ? parcel.description.trim() : ''

      return {
        boxNowParcelId:
          typeof parcel.boxNowParcelId === 'string' && parcel.boxNowParcelId.trim()
            ? parcel.boxNowParcelId.trim()
            : undefined,
        compartmentSize,
        description,
        id:
          typeof parcel.id === 'string' && parcel.id.trim() ? parcel.id.trim() : `boxnow-parcel-${index + 1}`,
        weight,
      }
    })
    .filter((parcel) => Number.isFinite(parcel.weight) && parcel.weight > 0)
}

const validateParcels = (parcels: ReturnType<typeof sanitizeParcels>) => {
  if (parcels.length === 0) {
    throw new EndpointError('Добави поне един BoxNow колет с тегло и размер.')
  }

  for (const parcel of parcels) {
    if (![1, 2, 3].includes(parcel.compartmentSize)) {
      throw new EndpointError('Всеки BoxNow колет трябва да има размер 1, 2 или 3.')
    }
  }
}

const normalizeCompartmentSize = (value: number): 1 | 2 | 3 => {
  if (value === 1 || value === 2 || value === 3) {
    return value
  }

  throw new EndpointError('Всеки BoxNow колет трябва да има размер 1, 2 или 3.')
}

const getRecipientName = (order: BoxNowShipmentOrder) => {
  const firstName = order.shippingAddress?.firstName?.trim()
  const lastName = order.shippingAddress?.lastName?.trim()
  return [firstName, lastName].filter(Boolean).join(' ').trim()
}

const normalizePhoneForBoxNow = (phone?: string | null) => {
  const raw = typeof phone === 'string' ? phone.trim() : ''

  if (!raw) return ''

  const normalized = raw.replace(/[^\d+]/g, '')

  if (normalized.startsWith('+')) {
    return normalized
  }

  if (normalized.startsWith('00')) {
    return `+${normalized.slice(2)}`
  }

  if (normalized.startsWith('359')) {
    return `+${normalized}`
  }

  if (normalized.startsWith('0') && normalized.length === 10) {
    return `+359${normalized.slice(1)}`
  }

  if (normalized.length === 9 && normalized.startsWith('8')) {
    return `+359${normalized}`
  }

  return normalized
}

const getRecipientPhone = (order: BoxNowShipmentOrder) =>
  normalizePhoneForBoxNow(order.shippingAddress?.phone)

const buildOrderItemSummary = (order: BoxNowShipmentOrder) => {
  const labels = (order.items || [])
    .map((item) => {
      const productTitle =
        item.product && typeof item.product === 'object' && typeof item.product.title === 'string'
          ? item.product.title.trim()
          : ''

      return productTitle || item.productSKU?.trim() || ''
    })
    .filter(Boolean)

  return labels.join(', ')
}

const getOrderTransaction = async (req: PayloadRequest, order: BoxNowShipmentOrder) => {
  const transactionRef = Array.isArray(order.transactions) ? order.transactions[0] : null
  const transactionID =
    transactionRef && typeof transactionRef === 'object' ? transactionRef.id : transactionRef

  if (!transactionID) {
    throw new Error('Липсва транзакция към поръчката.')
  }

  return (await req.payload.findByID({
    collection: TRANSACTIONS_COLLECTION,
    depth: 0,
    id: String(transactionID),
    overrideAccess: true,
    req,
  })) as Transaction
}

const loadOrder = async (req: PayloadRequest, id: string) => {
  return (await req.payload.findByID({
    collection: ORDERS_COLLECTION,
    depth: 2,
    id,
    overrideAccess: true,
    req,
  })) as BoxNowShipmentOrder
}

export const boxNowCreateShipmentHandler: PayloadHandler = async (req) => {
  const authError = ensureAdmin(req)
  if (authError) return authError

  const orderID = req.routeParams?.id

  if (!orderID) {
    return jsonError('Липсва идентификатор на поръчката.', 400)
  }

  try {
    const order = await loadOrder(req, String(orderID))

    if (!order) {
      return jsonError('Поръчката не беше намерена.', 404)
    }

    if (order.deliveryMethod !== 'boxnow') {
      return jsonError('Поръчката не е с доставка до BoxNow автомат.', 400)
    }

    if (order.boxNowDeliveryRequestId) {
      return jsonError('За тази поръчка вече има създадена BoxNow пратка.', 409)
    }

    const body = (await req.json?.().catch(() => null)) as ShipmentRequestBody | null
    const parcels = sanitizeParcels(body?.parcels || order.boxNowParcels)
    validateParcels(parcels)

    const recipientName = getRecipientName(order)
    const recipientPhone = getRecipientPhone(order)
    const recipientEmail = order.customerEmail?.trim() || ''

    if (!order.boxNowLockerId) {
      throw new EndpointError('Липсва избран BoxNow автомат в поръчката.')
    }

    if (!recipientName || !recipientPhone || !recipientEmail) {
      throw new EndpointError('Липсват име, телефон или имейл на клиента в поръчката.')
    }

    const transaction = await getOrderTransaction(req, order)
    const paymentMode = transaction.paymentMethod === 'revolut' ? 'prepaid' : 'cod'
    const parcelValues = splitAmountAcrossParcels(order.amount || 0, parcels.length)
    const defaultDescription = buildOrderItemSummary(order)

    const shipment = await createBoxNowDeliveryRequest({
      amountToBeCollected: paymentMode === 'cod' ? parseMoney(order.amount) : '0.00',
      contactEmail: recipientEmail,
      contactName: recipientName,
      contactNumber: recipientPhone,
      destinationLocationId: order.boxNowLockerId,
      invoiceValue: parseMoney(order.amount),
      items: parcels.map((parcel, index) => ({
        compartmentSize: parcel.compartmentSize as 1 | 2 | 3,
        id: `${order.id}-${index + 1}`,
        name: parcel.description || defaultDescription || `Пратка ${index + 1}`,
        value: parcelValues[index] || '0.00',
        weight: parcel.weight,
      })),
      orderNumber: String(order.id),
      originLocationId: BOXNOW_ORIGIN_LOCATION_ID,
      paymentMode,
    })

    const updatedParcels = parcels.map((parcel, index) => ({
      ...parcel,
      boxNowParcelId: shipment.parcelIds[index] || null,
      compartmentSize: normalizeCompartmentSize(parcel.compartmentSize),
    }))

    await req.payload.update({
      collection: ORDERS_COLLECTION,
      data: {
        boxNowDeliveryRequestId: shipment.deliveryRequestId,
        boxNowParcels: updatedParcels,
        boxNowShipmentCreatedAt: new Date().toISOString(),
        boxNowShipmentError: null,
        boxNowShipmentStatus: 'created',
      },
      id: String(orderID),
      overrideAccess: true,
      req,
    })

    return Response.json(
      {
        deliveryRequestId: shipment.deliveryRequestId,
        parcelIds: shipment.parcelIds,
      },
      { status: 200 },
    )
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Неуспешно създаване на BoxNow пратка.'
    const status = error instanceof EndpointError ? error.status : 500

    if (message === 'P405') {
      message =
        'BoxNow отказа телефона на клиента. Номерът трябва да е в международен формат, например +359888123456.'
    }

    await req.payload
      .update({
        collection: ORDERS_COLLECTION,
        data: {
          boxNowShipmentError: message,
          boxNowShipmentStatus: 'error',
        },
        id: String(orderID),
        overrideAccess: true,
        req,
      })
      .catch(() => undefined)

    return jsonError(message, status)
  }
}

export const boxNowParcelLabelHandler: PayloadHandler = async (req) => {
  const authError = ensureAdmin(req)
  if (authError) return authError

  const orderID = req.routeParams?.id
  const parcelID = req.routeParams?.parcelId

  if (!orderID || !parcelID) {
    return jsonError('Липсват идентификатори за поръчка или колет.', 400)
  }

  try {
    const order = await loadOrder(req, String(orderID))

    if (!order?.boxNowDeliveryRequestId) {
      return jsonError('За тази поръчка още няма създадена BoxNow пратка.', 404)
    }

    const knownParcelIDs = (Array.isArray(order.boxNowParcels) ? order.boxNowParcels : [])
      .map((parcel) => parcel.boxNowParcelId?.trim())
      .filter((value): value is string => Boolean(value))

    if (!knownParcelIDs.includes(String(parcelID))) {
      return jsonError('Този BoxNow колет не принадлежи на поръчката.', 404)
    }

    const pdfBuffer = await downloadBoxNowParcelLabel(String(parcelID))

    return new Response(pdfBuffer, {
      headers: {
        'Content-Disposition': `inline; filename=\"boxnow-${parcelID}.pdf\"`,
        'Content-Type': 'application/pdf',
      },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неуспешно зареждане на BoxNow етикет.'
    return jsonError(message, 500)
  }
}
