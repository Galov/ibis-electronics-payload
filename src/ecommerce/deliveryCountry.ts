import { getDeliveryShippingFee, type DeliveryMethod } from '@/utilities/delivery'
import {
  internationalDestinations,
  internationalPostalIssue,
  isInternationalCountry,
} from './internationalDelivery'

/** International tariffs are not enabled yet. Language must not change the delivery policy. */
export function assertDomesticDelivery(data: {
  billingAddress?: { country?: unknown }
  shippingAddress?: { country?: unknown }
}) {
  const address = data.shippingAddress ?? data.billingAddress
  if (typeof address?.country === 'string' && address.country.trim().toUpperCase() !== 'BG') {
    throw new Error('Доставката в момента е достъпна само в България.')
  }
}

/** Shared server/browser resolver. Never trusts a submitted shipping fee. */
export function resolveDelivery(
  data: {
    billingAddress?: { country?: unknown }
    shippingAddress?: {
      country?: unknown
      postalCode?: unknown
      city?: unknown
      addressLine1?: unknown
    }
    deliveryMethod?: string | null
    customerEmail?: string
  },
  payment: string,
  currency = 'EUR',
) {
  const address = data.shippingAddress ?? data.billingAddress
  const country = typeof address?.country === 'string' ? address.country.trim().toUpperCase() : 'BG'
  if (country === 'BG') return getDeliveryShippingFee(data.deliveryMethod as DeliveryMethod)
  if (!isInternationalCountry(country))
    throw Error('Delivery is not available for this country. For Romania, use ibis-electronics.ro.')
  if (payment !== 'revolut') throw Error('International orders require online payment.')
  if (currency !== 'EUR') throw Error('International checkout requires EUR.')
  if (data.deliveryMethod !== 'address')
    throw Error('International delivery is available to an address only.')
  const shipping = data.shippingAddress
  if (
    !shipping ||
    !String(shipping.city || '').trim() ||
    !String(shipping.addressLine1 || '').trim()
  )
    throw Error('Enter a complete shipping address.')
  const issue = internationalPostalIssue(country, shipping.postalCode)
  if (issue === 'invalid') throw Error('Enter a valid postal code for the delivery country.')
  if (issue === 'enquiry')
    throw Error('Please contact us for delivery to this postal code before ordering.')
  if (
    !data.customerEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail) ||
    data.customerEmail.endsWith('@orders.ibiselectronics.local')
  )
    throw Error('A valid email address is required for international delivery.')
  return internationalDestinations[country].fee
}
