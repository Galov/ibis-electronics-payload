import type { PayloadRequest } from 'payload'

type OrderReportOrder = {
  id: string
  createdAt?: string | null
  updatedAt?: string | null
  status?: string | null
  amount?: number | null
  shippingFee?: number | null
  currency?: string | null
  paymentMethod?: string | null
  deliveryMethod?: string | null
  customerEmail?: string | null
  customer?: string | { id?: string | null } | null
  shippingAddress?: {
    firstName?: string | null
    lastName?: string | null
    company?: string | null
    city?: string | null
    country?: string | null
  } | null
  items?: { quantity?: number | null }[] | null
}

export type OrdersReportSummary = {
  month: string
  range: {
    from: string
    to: string
  }
  orderCount: number
  turnover: number
  cancelledCount: number
  cancelledAmount: number
  averageOrderValue: number
  byStatus: Array<{
    status: string
    orderCount: number
    amount: number
  }>
}

const INCLUDED_STATUSES = new Set(['processing', 'completed'])

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  manual: 'Наложен платеж',
  revolut: 'Плащане онлайн',
}

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  address: 'Адрес',
  boxnow: 'BoxNow',
  'econt-office': 'Econt офис',
  'speedy-office': 'Speedy офис',
}

const STATUS_LABELS: Record<string, string> = {
  cancelled: 'Отказана',
  completed: 'Завършена',
  processing: 'Обработва се',
}

export const getMonthDateRange = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Невалиден месец. Използвайте формат YYYY-MM.')
  }

  const [yearPart, monthPart] = month.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('Невалиден месец. Използвайте формат YYYY-MM.')
  }

  const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
  const to = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0))

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

const toCurrencyNumber = (value: number | null | undefined) => (typeof value === 'number' ? value : 0)

const getStatusLabel = (status?: string | null) => {
  if (!status) return 'Без статус'
  return STATUS_LABELS[status] || status
}

const getPaymentMethodLabel = (paymentMethod?: string | null) => {
  if (!paymentMethod) return ''
  return PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod
}

const getDeliveryMethodLabel = (deliveryMethod?: string | null) => {
  if (!deliveryMethod) return ''
  return DELIVERY_METHOD_LABELS[deliveryMethod] || deliveryMethod
}

const getCustomerId = (customer: OrderReportOrder['customer']) => {
  if (!customer) return ''
  if (typeof customer === 'string') return customer
  return customer.id || ''
}

const getCustomerName = (shippingAddress: OrderReportOrder['shippingAddress']) => {
  const firstName = shippingAddress?.firstName?.trim() || ''
  const lastName = shippingAddress?.lastName?.trim() || ''
  return `${firstName} ${lastName}`.trim()
}

const escapeCsvValue = (value: string | number) => {
  const normalized = String(value).replaceAll('"', '""')
  return `"${normalized}"`
}

const formatAmount = (amount: number) => amount.toFixed(2)

export const fetchOrdersForMonth = async ({
  month,
  req,
}: {
  month: string
  req: PayloadRequest
}): Promise<OrderReportOrder[]> => {
  const range = getMonthDateRange(month)
  const result = await req.payload.find({
    collection: 'orders',
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
    req,
    select: {
      amount: true,
      createdAt: true,
      currency: true,
      customer: true,
      customerEmail: true,
      deliveryMethod: true,
      items: true,
      paymentMethod: true,
      shippingAddress: true,
      shippingFee: true,
      status: true,
      updatedAt: true,
    },
    where: {
      and: [
        {
          createdAt: {
            greater_than_equal: range.from,
          },
        },
        {
          createdAt: {
            less_than: range.to,
          },
        },
      ],
    },
  })

  return result.docs as OrderReportOrder[]
}

export const buildOrdersReportSummary = ({
  month,
  orders,
}: {
  month: string
  orders: OrderReportOrder[]
}): OrdersReportSummary => {
  const range = getMonthDateRange(month)
  const byStatusMap = new Map<string, { orderCount: number; amount: number }>()

  let turnover = 0
  let orderCount = 0
  let cancelledCount = 0
  let cancelledAmount = 0

  for (const order of orders) {
    const status = order.status || 'unknown'
    const amount = toCurrencyNumber(order.amount)
    const existing = byStatusMap.get(status) || { orderCount: 0, amount: 0 }

    existing.orderCount += 1
    existing.amount += amount
    byStatusMap.set(status, existing)

    if (status === 'cancelled') {
      cancelledCount += 1
      cancelledAmount += amount
    }

    if (INCLUDED_STATUSES.has(status)) {
      orderCount += 1
      turnover += amount
    }
  }

  const averageOrderValue = orderCount > 0 ? turnover / orderCount : 0

  return {
    month,
    range,
    orderCount,
    turnover,
    cancelledCount,
    cancelledAmount,
    averageOrderValue,
    byStatus: [...byStatusMap.entries()]
      .map(([status, data]) => ({
        status,
        orderCount: data.orderCount,
        amount: data.amount,
      }))
      .sort((left, right) => left.status.localeCompare(right.status)),
  }
}

export const buildOrdersCsv = ({
  month,
  orders,
}: {
  month: string
  orders: OrderReportOrder[]
}) => {
  const summary = buildOrdersReportSummary({ month, orders })

  const header = [
    'ID',
    'Дата',
    'Статус',
    'Сума',
    'Валута',
    'Доставка',
    'Начин на плащане',
    'Начин на доставка',
    'Имейл',
    'Клиент',
    'Компания',
    'Град',
    'Държава',
    'Брой артикули',
    'Общо количество',
    'Регистриран клиент ID',
  ]

  const rows = orders.map((order) => {
    const itemCount = Array.isArray(order.items) ? order.items.length : 0
    const totalQuantity = Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
      : 0

    return [
      order.id,
      order.createdAt || '',
      getStatusLabel(order.status),
      formatAmount(toCurrencyNumber(order.amount)),
      order.currency || '',
      formatAmount(toCurrencyNumber(order.shippingFee)),
      getPaymentMethodLabel(order.paymentMethod),
      getDeliveryMethodLabel(order.deliveryMethod),
      order.customerEmail || '',
      getCustomerName(order.shippingAddress),
      order.shippingAddress?.company || '',
      order.shippingAddress?.city || '',
      order.shippingAddress?.country || '',
      itemCount,
      totalQuantity,
      getCustomerId(order.customer),
    ]
  })

  const summaryLines = [
    ['Месец', summary.month],
    ['Оборот (processing + completed)', formatAmount(summary.turnover)],
    ['Брой поръчки', summary.orderCount],
    ['Средна стойност', formatAmount(summary.averageOrderValue)],
    ['Отказани поръчки', summary.cancelledCount],
    ['Сума на отказаните', formatAmount(summary.cancelledAmount)],
  ]

  return [
    ...summaryLines.map((line) => line.map(escapeCsvValue).join(',')),
    '',
    header.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\n')
}
