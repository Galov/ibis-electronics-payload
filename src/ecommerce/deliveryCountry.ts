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
