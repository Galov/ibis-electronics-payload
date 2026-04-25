import type {
  PaymentAdapter,
  PaymentAdapterClient,
} from '@payloadcms/plugin-ecommerce/types'
import type { Payload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

type ManualOrderData = {
  billingAddress?: Record<string, unknown>
  customerEmail?: string
  customerNotes?: string
  deliveryMethod?: 'address' | 'speedy-office' | 'econt-office'
  econtOffice?: {
    address?: string
    cityId?: string
    cityName?: string
    code?: string
    id?: string
    name?: string
    regionId?: string
    regionName?: string
  }
  shippingFee?: number
  shippingAddress?: Record<string, unknown>
  speedyOffice?: {
    address?: string
    id?: string
    name?: string
    siteId?: string
    siteName?: string
    stateId?: string
    stateName?: string
  }
}

type OrderEmailItem = {
  product?: unknown
  productSKU?: string | null
  quantity?: number | null
}

type OrderEmailAddress = {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  country?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  postalCode?: string | null
  state?: string | null
}

const escapeHTML = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatMoney = (value?: null | number, currency = 'EUR') => {
  if (typeof value !== 'number') return '-'

  return new Intl.NumberFormat('bg-BG', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)
}

const getProductTitle = (product: unknown) => {
  if (product && typeof product === 'object' && 'title' in product) {
    return String((product as { title?: unknown }).title || '')
  }

  return ''
}

const formatAddress = (address?: OrderEmailAddress | null) => {
  if (!address) return ''

  return [
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.phone,
    address.addressLine1,
    address.addressLine2,
    [address.postalCode, address.city].filter(Boolean).join(' '),
    address.state,
    address.country,
  ]
    .filter(Boolean)
    .map(escapeHTML)
    .join('<br />')
}

const getDeliveryLabel = (deliveryMethod?: ManualOrderData['deliveryMethod']) => {
  switch (deliveryMethod) {
    case 'econt-office':
      return 'Офис на Econt'
    case 'speedy-office':
      return 'Офис на Speedy'
    default:
      return 'До адрес'
  }
}

const buildOrderItemsHTML = (items?: null | OrderEmailItem[]) => {
  if (!items?.length) return '<p>Няма артикули.</p>'

  return `
    <ul>
      ${items
        .map((item) => {
          const title = getProductTitle(item.product)
          const sku = item.productSKU ? ` (${escapeHTML(item.productSKU)})` : ''
          const label = title || item.productSKU || 'Продукт'

          return `<li>${escapeHTML(label)}${sku} - ${item.quantity || 0} бр.</li>`
        })
        .join('')}
    </ul>
  `
}

const sendOrderEmails = async ({
  amount,
  adminEmails,
  currency,
  customerEmail,
  customerNotes,
  deliveryMethod,
  econtOfficeAddress,
  econtOfficeName,
  items,
  orderID,
  orderAdminURL,
  orderURL,
  payload,
  shippingAddress,
  shippingFee,
  speedyOfficeAddress,
  speedyOfficeName,
}: {
  amount: number
  adminEmails: string[]
  currency: string
  customerEmail?: string
  customerNotes?: string
  deliveryMethod?: ManualOrderData['deliveryMethod']
  econtOfficeAddress?: string
  econtOfficeName?: string
  items?: OrderEmailItem[]
  orderID: string
  orderAdminURL: string
  orderURL: string
  payload: Payload
  shippingAddress?: OrderEmailAddress
  shippingFee: number
  speedyOfficeAddress?: string
  speedyOfficeName?: string
}) => {
  const deliveryLabel = getDeliveryLabel(deliveryMethod)
  const officeInfo =
    deliveryMethod === 'econt-office'
      ? [econtOfficeName, econtOfficeAddress].filter(Boolean).join(', ')
      : deliveryMethod === 'speedy-office'
        ? [speedyOfficeName, speedyOfficeAddress].filter(Boolean).join(', ')
        : ''
  const notes = customerNotes?.trim()
  const itemsHTML = buildOrderItemsHTML(items)

  const customerHTML = `
    <h1>Поръчката е приета</h1>
    <p>Благодарим ви. Получихме поръчка #${escapeHTML(orderID)}.</p>
    <p><strong>Сума:</strong> ${escapeHTML(formatMoney(amount, currency))}</p>
    <p><strong>Доставка:</strong> ${escapeHTML(deliveryLabel)}</p>
    ${officeInfo ? `<p><strong>Офис:</strong> ${escapeHTML(officeInfo)}</p>` : ''}
    ${shippingFee ? `<p><strong>Цена на доставка:</strong> ${escapeHTML(formatMoney(shippingFee, currency))}</p>` : ''}
    <h2>Артикули</h2>
    ${itemsHTML}
    <p><a href="${escapeHTML(orderURL)}">Преглед на поръчката</a></p>
  `

  const adminHTML = `
    <h1>Нова поръчка #${escapeHTML(orderID)}</h1>
    <p><strong>Клиентски имейл:</strong> ${escapeHTML(customerEmail || '-')}</p>
    <p><strong>Сума:</strong> ${escapeHTML(formatMoney(amount, currency))}</p>
    <p><strong>Доставка:</strong> ${escapeHTML(deliveryLabel)}</p>
    ${officeInfo ? `<p><strong>Офис:</strong> ${escapeHTML(officeInfo)}</p>` : ''}
    ${shippingAddress ? `<p><strong>Адрес:</strong><br />${formatAddress(shippingAddress)}</p>` : ''}
    ${notes ? `<p><strong>Бележки:</strong><br />${escapeHTML(notes)}</p>` : ''}
    <h2>Артикули</h2>
    ${itemsHTML}
    <p><a href="${escapeHTML(orderAdminURL)}">Преглед в админа</a></p>
  `

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

export const manualAdapter = (): PaymentAdapter => ({
  name: 'manual',
  label: 'Изпрати поръчката',
  group: {
    name: 'manual',
    type: 'group',
    admin: {
      condition: (data) => data?.paymentMethod === 'manual',
    },
    fields: [],
  },
  initiatePayment: async () => {
    return {
      message: 'Прегледът на поръчката започна.',
    }
  },
  confirmOrder: async ({
    data,
    req,
  }) => {
    const payload = req.payload
    const user = req.user
    const {
      billingAddress,
      customerEmail,
      customerNotes,
      deliveryMethod,
      econtOffice,
      shippingAddress,
      shippingFee,
      speedyOffice,
    } =
      (data || {}) as ManualOrderData
    const cartsSlug = 'carts'
    const ordersSlug = 'orders'
    const transactionsSlug = 'transactions'

    let cartID = data?.cartID as string | undefined
    const cartSecret = data?.secret as string | undefined

    if (user?.cart?.docs?.length && !cartID) {
      const firstCart = user.cart.docs[0]
      cartID = typeof firstCart === 'object' ? String(firstCart.id) : String(firstCart)
    }

    if (!cartID) {
      throw new Error('Необходим е идентификатор на количката.')
    }

    if (cartSecret) {
      req.query = req.query || {}
      req.query.secret = cartSecret
    }

    const cart = await payload.findByID({
      id: cartID,
      collection: cartsSlug,
      depth: 2,
      overrideAccess: false,
      req,
      select: {
        currency: true,
        customer: true,
        items: true,
        subtotal: true,
      },
    })

    if (!cart?.items?.length) {
      throw new Error('Количката е празна.')
    }

    const resolvedEmail = user?.email || customerEmail

    const normalizedItems = cart.items.map((item) => {
      const product =
        item.product && typeof item.product === 'object' ? item.product : null

      return {
        ...item,
        productSKU: product?.sku || undefined,
        productUnitPrice: typeof product?.price === 'number' ? product.price : undefined,
      }
    })

    const normalizedShippingFee = typeof shippingFee === 'number' ? shippingFee : 0
    const totalAmount = (cart.subtotal || 0) + normalizedShippingFee

    const transaction = await payload.create({
      collection: transactionsSlug,
      data: {
        amount: totalAmount,
        billingAddress,
        cart: cart.id,
        currency: cart.currency,
        customer: user?.id || undefined,
        ...(resolvedEmail ? { customerEmail: resolvedEmail } : {}),
        items: normalizedItems,
        paymentMethod: 'manual',
        status: 'pending',
      },
      overrideAccess: true,
      req,
    })

    const order = await payload.create({
      collection: ordersSlug,
      data: {
        amount: totalAmount,
        currency: cart.currency,
        customer: user?.id || undefined,
        ...(resolvedEmail ? { customerEmail: resolvedEmail } : {}),
        customerNotes: customerNotes?.trim() || undefined,
        deliveryMethod: deliveryMethod || 'address',
        econtOfficeAddress:
          econtOffice && (econtOffice.name || econtOffice.address || econtOffice.cityName || econtOffice.regionName)
            ? [econtOffice.regionName, econtOffice.cityName, econtOffice.address].filter(Boolean).join(', ')
            : undefined,
        econtOfficeCode: econtOffice?.code || undefined,
        econtOfficeId: econtOffice?.id || undefined,
        econtOfficeName: econtOffice?.name || undefined,
        items: normalizedItems,
        shippingFee: normalizedShippingFee,
        shippingAddress,
        speedyOfficeAddress:
          speedyOffice &&
          (speedyOffice.name || speedyOffice.address || speedyOffice.siteName || speedyOffice.stateName)
            ? [speedyOffice.stateName, speedyOffice.siteName, speedyOffice.address]
                .filter(Boolean)
                .join(', ')
            : undefined,
        speedyOfficeId: speedyOffice?.id || undefined,
        speedyOfficeName: speedyOffice?.name || undefined,
        status: 'processing',
        transactions: [transaction.id],
      },
      overrideAccess: true,
      req,
    })

    await payload.update({
      id: transaction.id,
      collection: transactionsSlug,
      data: {
        order: order.id,
        status: 'succeeded',
      },
      overrideAccess: true,
      req,
    })

    await payload.update({
      id: cart.id,
      collection: cartsSlug,
      data: {
        items: [],
        purchasedAt: new Date().toISOString(),
      },
      overrideAccess: true,
      req,
    })

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
      order.accessToken && resolvedEmail
        ? `${serverURL}/orders/${order.id}?email=${encodeURIComponent(resolvedEmail)}&accessToken=${encodeURIComponent(order.accessToken)}`
        : `${serverURL}/orders/${order.id}`
    const orderAdminURL = `${serverURL}/admin/collections/orders/${order.id}`

    await sendOrderEmails({
      amount: totalAmount,
      adminEmails,
      currency: cart.currency || 'EUR',
      customerEmail: resolvedEmail,
      customerNotes,
      deliveryMethod,
      econtOfficeAddress:
        econtOffice && (econtOffice.name || econtOffice.address || econtOffice.cityName || econtOffice.regionName)
          ? [econtOffice.regionName, econtOffice.cityName, econtOffice.address].filter(Boolean).join(', ')
          : undefined,
      econtOfficeName: econtOffice?.name || undefined,
      items: normalizedItems,
      orderAdminURL,
      orderID: order.id,
      orderURL,
      payload,
      shippingAddress: shippingAddress as OrderEmailAddress | undefined,
      shippingFee: normalizedShippingFee,
      speedyOfficeAddress:
        speedyOffice &&
        (speedyOffice.name || speedyOffice.address || speedyOffice.siteName || speedyOffice.stateName)
          ? [speedyOffice.stateName, speedyOffice.siteName, speedyOffice.address].filter(Boolean).join(', ')
          : undefined,
      speedyOfficeName: speedyOffice?.name || undefined,
    })

    return {
      message: 'Поръчката беше изпратена успешно.',
      accessToken: typeof order.accessToken === 'string' ? order.accessToken : '',
      orderID: order.id,
      transactionID: transaction.id,
    }
  },
})

export const manualAdapterClient = (): PaymentAdapterClient => ({
  name: 'manual',
  label: 'Изпрати поръчката',
  confirmOrder: true,
  initiatePayment: false,
})
