import {
  internationalDestinations,
  isInternationalCountry,
  type InternationalCountry,
} from './internationalDelivery'
export const ROMANIAN_STOREFRONT = 'https://ibis-electronics.ro/'
export type CheckoutCountry = '' | 'BG' | 'RO' | InternationalCountry

// Explicit allowlist; country policy is independent of the interface language.
export function getCheckoutDestination(
  country: string,
):
  | { kind: 'local'; country: 'BG'; paymentMethods: readonly ['manual', 'revolut'] }
  | { kind: 'redirect'; country: 'RO'; url: string }
  | {
      kind: 'international'
      country: InternationalCountry
      shippingFee: number
      paymentMethods: readonly ['revolut']
    }
  | { kind: 'unavailable' } {
  if (country === 'BG') return { kind: 'local', country, paymentMethods: ['manual', 'revolut'] }
  if (country === 'RO') return { kind: 'redirect', country, url: ROMANIAN_STOREFRONT }
  if (isInternationalCountry(country))
    return {
      kind: 'international',
      country,
      shippingFee: internationalDestinations[country].fee,
      paymentMethods: ['revolut'],
    }
  return { kind: 'unavailable' }
}
