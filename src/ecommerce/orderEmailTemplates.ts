import { getDeliveryMethodLabel, getDeliveryPricingNote, type DeliveryMethod } from '@/utilities/delivery'

export type OrderEmailItem = {
  product?: unknown
  productSKU?: string | null
  productUnitPrice?: number | null
  quantity?: number | null
}

export type OrderEmailAddress = {
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

export type OrderEmailDeliveryMethod = DeliveryMethod
export type OrderEmailPaymentMethod = 'manual' | 'revolut'

type OrderEmailTemplateArgs = {
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
  shippingAddress?: OrderEmailAddress
  shippingFee: number
  speedyOfficeAddress?: string
  speedyOfficeName?: string
}

const brandBlue = 'rgb(1,55,186)'
const logoURL = 'https://ibis-electronics.com/ibis_blue_logo.png'

export const escapeHTML = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const formatMoney = (value?: null | number, currency = 'EUR') => {
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

export const formatAddressHTML = (address?: OrderEmailAddress | null) => {
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

export const getPaymentMethodLabel = (paymentMethod?: OrderEmailPaymentMethod) => {
  switch (paymentMethod) {
    case 'revolut':
      return 'Плащане онлайн'
    default:
      return 'При доставка'
  }
}

const buildOrderItemsRowsHTML = (items?: null | OrderEmailItem[], currency = 'EUR') => {
  if (!items?.length) {
    return `
      <tr>
        <td colspan="5" style="padding: 16px; color: #667085;">Няма артикули.</td>
      </tr>
    `
  }

  return items
    .map((item) => {
      const quantity = item.quantity || 0
      const title = getProductTitle(item.product) || item.productSKU || 'Продукт'
      const unitPrice = item.productUnitPrice
      const lineTotal = typeof unitPrice === 'number' ? unitPrice * quantity : null

      return `
        <tr>
          <td style="border-top: 1px solid #e8eef9; padding: 14px 12px; color: #243047;">
            ${escapeHTML(title)}
          </td>
          <td style="border-top: 1px solid #e8eef9; padding: 14px 12px; color: #667085;">
            ${escapeHTML(item.productSKU || '-')}
          </td>
          <td style="border-top: 1px solid #e8eef9; padding: 14px 12px; text-align: right; color: #243047;">
            ${quantity}
          </td>
          <td style="border-top: 1px solid #e8eef9; padding: 14px 12px; text-align: right; color: #243047;">
            ${escapeHTML(formatMoney(unitPrice, currency))}
          </td>
          <td style="border-top: 1px solid #e8eef9; padding: 14px 12px; text-align: right; color: #243047; font-weight: 600;">
            ${escapeHTML(formatMoney(lineTotal, currency))}
          </td>
        </tr>
      `
    })
    .join('')
}

const buildOrderItemsTableHTML = (items?: null | OrderEmailItem[], currency = 'EUR') => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; overflow: hidden; border: 1px solid #dbe6f8; border-radius: 12px; background: #ffffff;">
    <thead>
      <tr style="background: #f4f8ff;">
        <th align="left" style="padding: 12px; color: ${brandBlue}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Продукт</th>
        <th align="left" style="padding: 12px; color: ${brandBlue}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Код</th>
        <th align="right" style="padding: 12px; color: ${brandBlue}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Бр.</th>
        <th align="right" style="padding: 12px; color: ${brandBlue}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Ед. цена</th>
        <th align="right" style="padding: 12px; color: ${brandBlue}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Общо</th>
      </tr>
    </thead>
    <tbody>
      ${buildOrderItemsRowsHTML(items, currency)}
    </tbody>
  </table>
`

const buildDetailRow = (label: string, value?: string) => {
  if (!value) return ''

  return `
    <tr>
      <td style="padding: 8px 0; color: #667085;">${escapeHTML(label)}</td>
      <td align="right" style="padding: 8px 0; color: #243047; font-weight: 600;">${value}</td>
    </tr>
  `
}

const buildLayout = ({
  children,
  heading,
  preview,
}: {
  children: string
  heading: string
  preview: string
}) => `
  <!doctype html>
  <html lang="bg">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHTML(heading)}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f3f7fd; font-family: Arial, Helvetica, sans-serif; color: #243047;">
      <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHTML(preview)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f3f7fd;">
        <tr>
          <td align="center" style="padding: 28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 720px; overflow: hidden; border-radius: 18px; background: #ffffff; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);">
              <tr>
                <td style="border-bottom: 4px solid ${brandBlue}; padding: 28px 28px 22px;">
                  <img src="${logoURL}" width="170" alt="Ibis Electronics" style="display: block; height: auto; max-width: 170px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 28px 34px;">
                  <h1 style="margin: 0 0 18px; color: ${brandBlue}; font-size: 28px; line-height: 1.2; font-weight: 500;">${escapeHTML(heading)}</h1>
                  ${children}
                </td>
              </tr>
              <tr>
                <td style="background: ${brandBlue}; padding: 18px 28px; color: #ffffff; font-size: 13px; line-height: 1.6;">
                  Ibis Electronics<br />
                  <span style="color: rgba(255,255,255,0.78);">Автоматично съобщение от ibis-electronics.com</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`

export const buildCustomerOrderEmailHTML = (args: OrderEmailTemplateArgs) => {
  const deliveryLabel = getDeliveryMethodLabel(args.deliveryMethod)
  const paymentMethodLabel = getPaymentMethodLabel(args.paymentMethod)
  const officeName =
    args.deliveryMethod === 'boxnow'
      ? args.boxNowLockerName
      : args.deliveryMethod === 'econt-office'
        ? args.econtOfficeName
        : args.deliveryMethod === 'speedy-office'
          ? args.speedyOfficeName
          : undefined
  const officeAddress =
    args.deliveryMethod === 'boxnow'
      ? args.boxNowLockerAddress
      : args.deliveryMethod === 'econt-office'
        ? args.econtOfficeAddress
        : args.deliveryMethod === 'speedy-office'
          ? args.speedyOfficeAddress
          : undefined
  const deliveryPricingNote = getDeliveryPricingNote(args.deliveryMethod)

  return buildLayout({
    heading: 'Поръчката е приета',
    preview: `Получихме поръчка #${args.orderID}.`,
    children: `
      <p style="margin: 0 0 18px; color: #475467; font-size: 16px; line-height: 1.7;">
        Благодарим ви. Получихме поръчка <strong style="color: ${brandBlue};">#${escapeHTML(args.orderID)}</strong>.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
        ${buildDetailRow('Сума', escapeHTML(formatMoney(args.amount, args.currency)))}
        ${buildDetailRow('Начин на плащане', escapeHTML(paymentMethodLabel))}
        ${buildDetailRow('Доставка', escapeHTML(deliveryLabel))}
        ${officeName ? buildDetailRow('Офис', escapeHTML(officeName)) : ''}
        ${officeAddress ? buildDetailRow('Адрес на офис', escapeHTML(officeAddress)) : ''}
        ${args.shippingFee ? buildDetailRow('Цена на доставка', escapeHTML(formatMoney(args.shippingFee, args.currency))) : ''}
      </table>
      <p style="margin: 0 0 20px; color: #475467; font-size: 14px; line-height: 1.7;">
        ${escapeHTML(deliveryPricingNote)}
      </p>

      <h2 style="margin: 26px 0 12px; color: ${brandBlue}; font-size: 20px; line-height: 1.3; font-weight: 500;">Артикули</h2>
      ${buildOrderItemsTableHTML(args.items, args.currency)}

      <div style="margin-top: 28px;">
        <a href="${escapeHTML(args.orderURL)}" style="display: inline-block; border-radius: 10px; background: ${brandBlue}; padding: 13px 18px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none;">
          Преглед на поръчката
        </a>
      </div>
    `,
  })
}

export const buildAdminOrderEmailHTML = (args: OrderEmailTemplateArgs) => {
  const deliveryLabel = getDeliveryMethodLabel(args.deliveryMethod)
  const paymentMethodLabel = getPaymentMethodLabel(args.paymentMethod)
  const officeName =
    args.deliveryMethod === 'boxnow'
      ? args.boxNowLockerName
      : args.deliveryMethod === 'econt-office'
        ? args.econtOfficeName
        : args.deliveryMethod === 'speedy-office'
          ? args.speedyOfficeName
          : undefined
  const officeAddress =
    args.deliveryMethod === 'boxnow'
      ? args.boxNowLockerAddress
      : args.deliveryMethod === 'econt-office'
        ? args.econtOfficeAddress
        : args.deliveryMethod === 'speedy-office'
          ? args.speedyOfficeAddress
          : undefined
  const shippingAddressHTML = formatAddressHTML(args.shippingAddress)
  const notes = args.customerNotes?.trim()
  const deliveryPricingNote = getDeliveryPricingNote(args.deliveryMethod)

  return buildLayout({
    heading: `Нова поръчка #${args.orderID}`,
    preview: `Нова поръчка #${args.orderID} за ${formatMoney(args.amount, args.currency)}.`,
    children: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
        ${buildDetailRow('Клиентски имейл', escapeHTML(args.customerEmail || '-'))}
        ${buildDetailRow('Сума', escapeHTML(formatMoney(args.amount, args.currency)))}
        ${buildDetailRow('Начин на плащане', escapeHTML(paymentMethodLabel))}
        ${buildDetailRow('Доставка', escapeHTML(deliveryLabel))}
        ${officeName ? buildDetailRow('Офис', escapeHTML(officeName)) : ''}
        ${officeAddress ? buildDetailRow('Адрес на офис', escapeHTML(officeAddress)) : ''}
        ${args.shippingFee ? buildDetailRow('Цена на доставка', escapeHTML(formatMoney(args.shippingFee, args.currency))) : ''}
      </table>
      <p style="margin: 0 0 20px; color: #475467; font-size: 14px; line-height: 1.7;">
        ${escapeHTML(deliveryPricingNote)}
      </p>

      ${shippingAddressHTML ? `<h2 style="margin: 26px 0 8px; color: ${brandBlue}; font-size: 20px; line-height: 1.3; font-weight: 500;">Адрес</h2><p style="margin: 0 0 18px; color: #475467; font-size: 15px; line-height: 1.7;">${shippingAddressHTML}</p>` : ''}
      ${notes ? `<h2 style="margin: 26px 0 8px; color: ${brandBlue}; font-size: 20px; line-height: 1.3; font-weight: 500;">Бележки</h2><p style="margin: 0 0 18px; color: #475467; font-size: 15px; line-height: 1.7; white-space: pre-line;">${escapeHTML(notes)}</p>` : ''}

      <h2 style="margin: 26px 0 12px; color: ${brandBlue}; font-size: 20px; line-height: 1.3; font-weight: 500;">Артикули</h2>
      ${buildOrderItemsTableHTML(args.items, args.currency)}

      <div style="margin-top: 28px;">
        <a href="${escapeHTML(args.orderAdminURL)}" style="display: inline-block; border-radius: 10px; background: ${brandBlue}; padding: 13px 18px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none;">
          Преглед в админа
        </a>
      </div>
    `,
  })
}
