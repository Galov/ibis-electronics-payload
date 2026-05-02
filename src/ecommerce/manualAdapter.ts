import type { PaymentAdapter, PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'

import {
  createCheckoutTransactionData,
  finalizeCheckoutTransaction,
  type CheckoutPaymentData,
} from './orderLifecycle'

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
  confirmOrder: async ({ data, req }) => {
    const payload = req.payload
    const user = req.user
    const checkoutData = (data || {}) as CheckoutPaymentData
    const cartsSlug = 'carts'
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

    const transaction = await payload.create({
      collection: transactionsSlug,
      data: createCheckoutTransactionData({
        cart,
        checkoutData,
        paymentMethod: 'manual',
        user: user ? { email: user.email, id: user.id } : undefined,
      }),
      overrideAccess: true,
      req,
    })

    return finalizeCheckoutTransaction({
      req,
      transactionID: transaction.id,
    })
  },
})

export const manualAdapterClient = (): PaymentAdapterClient => ({
  name: 'manual',
  label: 'Изпрати поръчката',
  confirmOrder: true,
  initiatePayment: false,
})
