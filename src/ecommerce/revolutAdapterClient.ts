import type { PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'

export const revolutAdapterClient = (): PaymentAdapterClient => ({
  name: 'revolut',
  label: 'Revolut Pay',
  confirmOrder: true,
  initiatePayment: true,
})
