import type { Payload, PayloadRequest } from 'payload'

import type { Address, Cart, Product, Transaction, User } from '@/payload-types'
import type { DeliveryMethod } from '@/utilities/delivery'
import { getServerSideURL } from '@/utilities/getURL'

import {
  buildAdminOrderEmailHTML,
  buildCustomerOrderEmailHTML,
  type OrderEmailAddress,
  type OrderEmailDeliveryMethod,
  type OrderEmailItem,
  type OrderEmailPaymentMethod,
} from './orderEmailTemplates'

export type CheckoutEcontOffice = {
  address?: string
  cityId?: string
  cityName?: string
  code?: string
  id?: string
  name?: string
  regionId?: string
  regionName?: string
}

export type CheckoutSpeedyOffice = {
  address?: string
  id?: string
  name?: string
  siteId?: string
  siteName?: string
  stateId?: string
  stateName?: string
}

export type CheckoutBoxNowLocker = {
  address?: string
  id?: string
  latitude?: string
  longitude?: string
  name?: string
  postalCode?: string
}

export type CheckoutPaymentData = {
  billingAddress?: Partial<Address> | Record<string, unknown>
  boxNowLocker?: CheckoutBoxNowLocker
  customerEmail?: string
  customerNotes?: string
  deliveryMethod?: OrderEmailDeliveryMethod
  econtOffice?: CheckoutEcontOffice
  shippingFee?: number
  shippingAddress?: Partial<Address> | Record<string, unknown>
  speedyOffice?: CheckoutSpeedyOffice
}

type CreateCheckoutTransactionArgs = {
  cart: Pick<Cart, 'currency' | 'id' | 'items' | 'subtotal'>
  checkoutData: CheckoutPaymentData
  paymentMethod: NonNullable<Transaction['paymentMethod']>
  user?: null | Pick<User, 'email' | 'id'>
}

type FinalizeCheckoutTransactionArgs = {
  clearCartOnSuccess?: boolean
  req: PayloadRequest
  successStatus?: Transaction['status']
  transactionID: string
}

type OrderResult = {
  accessToken: string
  message: string
  orderID: string
  transactionID: string
}

type CheckoutTransaction = Transaction & {
  boxNowLockerAddress?: string | null
  boxNowLockerId?: string | null
  boxNowLockerName?: string | null
  boxNowLockerPostalCode?: string | null
  customerNotes?: string | null
  deliveryMethod?: DeliveryMethod | null
  econtOfficeAddress?: string | null
  econtOfficeCode?: string | null
  econtOfficeId?: string | null
  econtOfficeName?: string | null
  shippingAddress?: Transaction['billingAddress']
  shippingFee?: number | null
  speedyOfficeAddress?: string | null
  speedyOfficeId?: string | null
  speedyOfficeName?: string | null
}

const cartsSlug = 'carts'
const ordersSlug = 'orders'
const transactionsSlug = 'transactions'

const trimToUndefined = (value?: null | string) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const formatEcontOfficeAddress = (office?: CheckoutEcontOffice) => {
  if (!office || (!office.name && !office.address && !office.cityName && !office.regionName)) {
    return undefined
  }

  return [office.regionName, office.cityName, office.address].filter(Boolean).join(', ')
}

export const formatSpeedyOfficeAddress = (office?: CheckoutSpeedyOffice) => {
  if (!office || (!office.name && !office.address && !office.siteName && !office.stateName)) {
    return undefined
  }

  return [office.stateName, office.siteName, office.address].filter(Boolean).join(', ')
}

export const formatBoxNowLockerAddress = (locker?: CheckoutBoxNowLocker) => {
  if (!locker || (!locker.name && !locker.address && !locker.postalCode)) {
    return undefined
  }

  return [locker.postalCode, locker.address].filter(Boolean).join(', ')
}

const sendOrderEmails = async ({
  adminEmails,
  amount,
  boxNowLockerAddress,
  boxNowLockerName,
  currency,
  customerEmail,
  customerNotes,
  deliveryMethod,
  econtOfficeAddress,
  econtOfficeName,
  items,
  orderAdminURL,
  orderID,
  orderURL,
  paymentMethod,
  payload,
  shippingAddress,
  shippingFee,
  speedyOfficeAddress,
  speedyOfficeName,
}: {
  adminEmails: string[]
  amount: number
  boxNowLockerAddress?: string
  boxNowLockerName?: string
  currency: string
  customerEmail?: string
  customerNotes?: string
  deliveryMethod?: OrderEmailDeliveryMethod
  econtOfficeAddress?: string
  econtOfficeName?: string
  items?: OrderEmailItem[]
  orderAdminURL: string
  orderID: string
  orderURL: string
  paymentMethod?: OrderEmailPaymentMethod
  payload: Payload
  shippingAddress?: OrderEmailAddress
  shippingFee: number
  speedyOfficeAddress?: string
  speedyOfficeName?: string
}) => {
  const templateArgs = {
    amount,
    boxNowLockerAddress,
    boxNowLockerName,
    currency,
    customerEmail,
    customerNotes,
    deliveryMethod,
    econtOfficeAddress,
    econtOfficeName,
    items,
    orderAdminURL,
    orderID,
    orderURL,
    paymentMethod,
    shippingAddress,
    shippingFee,
    speedyOfficeAddress,
    speedyOfficeName,
  }
  const customerHTML = buildCustomerOrderEmailHTML(templateArgs)
  const adminHTML = buildAdminOrderEmailHTML(templateArgs)

  const emailTasks: Promise<unknown>[] = []

  if (customerEmail) {
    emailTasks.push(
      payload.sendEmail({
        html: customerHTML,
        subject: `Поръчка #${orderID} | Ibis Electronics`,
        to: customerEmail,
      }),
    )
  }

  if (adminEmails.length > 0) {
    for (const adminEmail of adminEmails) {
      emailTasks.push(
        payload.sendEmail({
          html: adminHTML,
          subject: `Нова поръчка #${orderID}`,
          to: adminEmail,
        }),
      )
    }
  } else {
    payload.logger.warn('No order notification recipients configured; admin order email was skipped.')
  }

  const results = await Promise.allSettled(emailTasks)
  const failures = results.filter((result) => result.status === 'rejected')

  if (failures.length > 0) {
    payload.logger.error({
      msg: 'Failed to send one or more order notification emails',
      failures,
      orderID,
    })
  }
}

export const normalizeCartItems = (
  items?: Cart['items'],
): {
  id?: string | null
  product?: Product | string | null
  productSKU?: string
  productUnitPrice?: number
  quantity: number
}[] => {
  return (items || []).map((item) => {
    const product = item.product && typeof item.product === 'object' ? item.product : null

    return {
      ...item,
      productSKU: product?.sku || undefined,
      productUnitPrice: typeof product?.price === 'number' ? product.price : undefined,
    }
  })
}

export const createCheckoutTransactionData = ({
  cart,
  checkoutData,
  paymentMethod,
  user,
}: CreateCheckoutTransactionArgs) => {
  const resolvedEmail = trimToUndefined(user?.email) || trimToUndefined(checkoutData.customerEmail)

  return {
    amount: cart.subtotal || 0,
    billingAddress: checkoutData.billingAddress,
    cart: cart.id,
    currency: cart.currency,
    customer: user?.id || undefined,
    ...(resolvedEmail ? { customerEmail: resolvedEmail } : {}),
    boxNowLockerAddress: formatBoxNowLockerAddress(checkoutData.boxNowLocker),
    boxNowLockerId: trimToUndefined(checkoutData.boxNowLocker?.id),
    boxNowLockerName: trimToUndefined(checkoutData.boxNowLocker?.name),
    boxNowLockerPostalCode: trimToUndefined(checkoutData.boxNowLocker?.postalCode),
    customerNotes: trimToUndefined(checkoutData.customerNotes),
    deliveryMethod: checkoutData.deliveryMethod || 'address',
    econtOfficeAddress: formatEcontOfficeAddress(checkoutData.econtOffice),
    econtOfficeCode: trimToUndefined(checkoutData.econtOffice?.code),
    econtOfficeId: trimToUndefined(checkoutData.econtOffice?.id),
    econtOfficeName: trimToUndefined(checkoutData.econtOffice?.name),
    items: normalizeCartItems(cart.items),
    paymentMethod,
    shippingAddress: checkoutData.shippingAddress,
    shippingFee: 0,
    speedyOfficeAddress: formatSpeedyOfficeAddress(checkoutData.speedyOffice),
    speedyOfficeId: trimToUndefined(checkoutData.speedyOffice?.id),
    speedyOfficeName: trimToUndefined(checkoutData.speedyOffice?.name),
    status: 'pending' as const,
  }
}

const buildOrderResult = (orderID: string, accessToken: string, transactionID: string): OrderResult => ({
  accessToken,
  message: 'Поръчката беше изпратена успешно.',
  orderID,
  transactionID,
})

export const finalizeCheckoutTransaction = async ({
  clearCartOnSuccess = true,
  req,
  successStatus = 'succeeded',
  transactionID,
}: FinalizeCheckoutTransactionArgs): Promise<OrderResult> => {
  const payload = req.payload

  const transaction = (await payload.findByID({
    collection: transactionsSlug,
    depth: 2,
    id: transactionID,
    overrideAccess: true,
    req,
  })) as CheckoutTransaction

  if (!transaction) {
    throw new Error('Транзакцията не беше намерена.')
  }

  if (transaction.order) {
    const existingOrderID =
      typeof transaction.order === 'object' ? transaction.order.id : String(transaction.order)
    const existingAccessToken =
      typeof transaction.order === 'object' && typeof transaction.order.accessToken === 'string'
        ? transaction.order.accessToken
        : ''

    return buildOrderResult(existingOrderID, existingAccessToken, transaction.id)
  }

  if (!transaction.items?.length) {
    throw new Error('Липсват артикули в транзакцията.')
  }

  payload.logger.info({
    msg: 'Finalizing checkout transaction into order',
    transactionID: transaction.id,
    customerEmail: transaction.customerEmail || null,
    deliveryMethod: transaction.deliveryMethod || null,
    boxNowLockerAddress: transaction.boxNowLockerAddress || null,
    boxNowLockerName: transaction.boxNowLockerName || null,
    shippingFee: transaction.shippingFee ?? null,
    speedyOfficeAddress: transaction.speedyOfficeAddress || null,
    speedyOfficeName: transaction.speedyOfficeName || null,
    econtOfficeAddress: transaction.econtOfficeAddress || null,
    econtOfficeName: transaction.econtOfficeName || null,
  })

  const order = await payload.create({
    collection: ordersSlug,
    data: {
      amount: transaction.amount,
      currency: transaction.currency,
      customer:
        transaction.customer && typeof transaction.customer === 'object'
          ? transaction.customer.id
          : transaction.customer || undefined,
      ...(transaction.customerEmail ? { customerEmail: transaction.customerEmail } : {}),
      boxNowLockerAddress: transaction.boxNowLockerAddress || undefined,
      boxNowLockerId: transaction.boxNowLockerId || undefined,
      boxNowLockerName: transaction.boxNowLockerName || undefined,
      boxNowLockerPostalCode: transaction.boxNowLockerPostalCode || undefined,
      customerNotes: transaction.customerNotes || undefined,
      deliveryMethod: transaction.deliveryMethod || 'address',
      econtOfficeAddress: transaction.econtOfficeAddress || undefined,
      econtOfficeCode: transaction.econtOfficeCode || undefined,
      econtOfficeId: transaction.econtOfficeId || undefined,
      econtOfficeName: transaction.econtOfficeName || undefined,
      items: transaction.items,
      shippingAddress: transaction.shippingAddress || undefined,
      shippingFee: typeof transaction.shippingFee === 'number' ? transaction.shippingFee : 0,
      speedyOfficeAddress: transaction.speedyOfficeAddress || undefined,
      speedyOfficeId: transaction.speedyOfficeId || undefined,
      speedyOfficeName: transaction.speedyOfficeName || undefined,
      status: 'processing',
      transactions: [transaction.id],
    },
    overrideAccess: true,
    req,
  })

  await payload.update({
    collection: transactionsSlug,
    data: {
      order: order.id,
      status: successStatus,
    },
    id: transaction.id,
    overrideAccess: true,
    req,
  })

  if (clearCartOnSuccess && transaction.cart) {
    const cartID = typeof transaction.cart === 'object' ? transaction.cart.id : String(transaction.cart)

    await payload.update({
      collection: cartsSlug,
      data: {
        items: [],
        purchasedAt: new Date().toISOString(),
      },
      id: cartID,
      overrideAccess: true,
      req,
    })
  }

  const serverURL = getServerSideURL()
  const orderSettings = await payload.findGlobal({
    slug: 'order-settings',
    depth: 0,
    overrideAccess: true,
    req,
  })
  const adminEmails = (orderSettings.notificationRecipients || [])
    .map((recipient) => recipient.email?.trim())
    .filter((email): email is string => Boolean(email))
  const orderURL =
    order.accessToken && transaction.customerEmail
      ? `${serverURL}/orders/${order.id}?email=${encodeURIComponent(transaction.customerEmail)}&accessToken=${encodeURIComponent(order.accessToken)}`
      : `${serverURL}/orders/${order.id}`
  const orderAdminURL = `${serverURL}/admin/collections/orders/${order.id}`

  await sendOrderEmails({
    adminEmails,
    amount: typeof transaction.amount === 'number' ? transaction.amount : 0,
    currency: transaction.currency || 'EUR',
    customerEmail: transaction.customerEmail || undefined,
    customerNotes: transaction.customerNotes || undefined,
    deliveryMethod: transaction.deliveryMethod || 'address',
    boxNowLockerAddress: transaction.boxNowLockerAddress || undefined,
    boxNowLockerName: transaction.boxNowLockerName || undefined,
    econtOfficeAddress: transaction.econtOfficeAddress || undefined,
    econtOfficeName: transaction.econtOfficeName || undefined,
    items: transaction.items as OrderEmailItem[] | undefined,
    orderAdminURL,
    orderID: order.id,
    orderURL,
    paymentMethod: transaction.paymentMethod === 'revolut' ? 'revolut' : 'manual',
    payload,
    shippingAddress: transaction.shippingAddress as OrderEmailAddress | undefined,
    shippingFee: typeof transaction.shippingFee === 'number' ? transaction.shippingFee : 0,
    speedyOfficeAddress: transaction.speedyOfficeAddress || undefined,
    speedyOfficeName: transaction.speedyOfficeName || undefined,
  })

  return buildOrderResult(order.id, typeof order.accessToken === 'string' ? order.accessToken : '', transaction.id)
}
