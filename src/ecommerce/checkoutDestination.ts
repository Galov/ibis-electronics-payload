export const ROMANIAN_STOREFRONT = 'https://ibis-electronics.ro/'
export type CheckoutCountry = '' | 'BG' | 'RO' | 'DE'

// Only explicitly configured destinations belong here; previews never permit orders.
// Add international shipping policies after tariff approval.
export function getCheckoutDestination(
  country: string,
):
  | { kind: 'local'; country: 'BG'; paymentMethods: readonly ['manual', 'revolut'] }
  | { kind: 'redirect'; country: 'RO'; url: string }
  | { kind: 'preview'; country: 'DE'; paymentMethods: readonly ['revolut']; canSubmit: false }
  | { kind: 'unavailable' } {
  if (country === 'BG') return { kind: 'local', country, paymentMethods: ['manual', 'revolut'] }
  if (country === 'RO') return { kind: 'redirect', country, url: ROMANIAN_STOREFRONT }
  if (country === 'DE')
    return { kind: 'preview', country, paymentMethods: ['revolut'], canSubmit: false }
  return { kind: 'unavailable' }
}
