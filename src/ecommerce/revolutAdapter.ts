import type { PaymentAdapter, PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'
import type { Field } from 'payload'
import type { Cart } from '@/payload-types'

import { finalizeCheckoutTransaction, createCheckoutTransactionData, type CheckoutPaymentData } from './orderLifecycle'
import {
  createRevolutOrder,
  isRevolutSuccessState,
  mapRevolutEventToTransactionStatus,
  retrieveRevolutOrder,
  verifyRevolutWebhookSignature,
} from './revolutApi'
import { getServerSideURL } from '@/utilities/getURL'

type RevolutWebhookPayload = {
  event?: string
  order_id?: string
}

const REVOLUT_CONFIRM_MAX_ATTEMPTS = 8
const REVOLUT_CONFIRM_RETRY_DELAY_MS = 1500
const cartsSlug = 'carts'

type RevolutAdapterData = CheckoutPaymentData & {
  cartID?: string
  cart?: Pick<Cart, 'currency' | 'id' | 'items' | 'subtotal'>
  currency?: string
  revolutOrderID?: string
  revolutPublicID?: string
  secret?: string
  transactionID?: string
}

type CartSnapshot = Pick<Cart, 'currency' | 'id' | 'items' | 'subtotal'>

type RevolutTransaction = {
  cart?: CartSnapshot | string | null
  id: string
  revolut?: {
    lastEvent?: string | null
    orderId?: string | null
    token?: string | null
    state?: string | null
  } | null
}

const transactionsSlug = 'transactions'

const revolutGroupFields: Field[] = [
  {
    name: 'orderId',
    type: 'text',
    label: 'Revolut Order ID',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'token',
    type: 'text',
    label: 'Revolut token',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'state',
    type: 'text',
    label: 'Revolut статус',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'lastEvent',
    type: 'text',
    label: 'Последен webhook event',
    admin: {
      readOnly: true,
    },
  },
]

const wait = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export const revolutAdapter = (): PaymentAdapter => ({
  name: 'revolut',
  label: 'Revolut Pay',
  group: {
    name: 'revolut',
    type: 'group',
    admin: {
      condition: (data) => data?.paymentMethod === 'revolut',
    },
    fields: revolutGroupFields,
  },
  initiatePayment: async ({ data, req }) => {
    const payload = req.payload
    const user = req.user
    const adapterData = data as RevolutAdapterData | undefined
    const checkoutData = (data || {}) as CheckoutPaymentData
    const cart = adapterData?.cart

    payload.logger.info({
      msg: 'Revolut initiate received checkout data',
      customerEmail: checkoutData.customerEmail || null,
      deliveryMethod: checkoutData.deliveryMethod || null,
      shippingFee:
        typeof checkoutData.shippingFee === 'number' && Number.isFinite(checkoutData.shippingFee)
          ? checkoutData.shippingFee
          : null,
      speedyOfficeAddress:
        checkoutData.speedyOffice && typeof checkoutData.speedyOffice.address === 'string'
          ? checkoutData.speedyOffice.address
          : null,
      speedyOfficeName:
        checkoutData.speedyOffice && typeof checkoutData.speedyOffice.name === 'string'
          ? checkoutData.speedyOffice.name
          : null,
      econtOfficeAddress:
        checkoutData.econtOffice && typeof checkoutData.econtOffice.address === 'string'
          ? checkoutData.econtOffice.address
          : null,
      econtOfficeName:
        checkoutData.econtOffice && typeof checkoutData.econtOffice.name === 'string'
          ? checkoutData.econtOffice.name
          : null,
    })

    if (!cart?.items?.length) {
      throw new Error('Количката е празна.')
    }

    const transaction = await payload.create({
      collection: transactionsSlug,
      data: createCheckoutTransactionData({
        cart,
        checkoutData,
        paymentMethod: 'revolut',
        user: user ? { email: user.email, id: user.id } : undefined,
      }),
      overrideAccess: true,
      req,
    })

    payload.logger.info({
      msg: 'Revolut checkout snapshot created',
      transactionID: transaction.id,
      customerEmail: transaction.customerEmail || null,
      deliveryMethod: transaction.deliveryMethod || null,
      shippingFee: transaction.shippingFee ?? null,
      speedyOfficeAddress: transaction.speedyOfficeAddress || null,
      speedyOfficeName: transaction.speedyOfficeName || null,
      econtOfficeAddress: transaction.econtOfficeAddress || null,
      econtOfficeName: transaction.econtOfficeName || null,
    })

    try {
      const serverURL = getServerSideURL()
      const redirectURL = serverURL.startsWith('https://')
        ? `${serverURL}/checkout/confirm-order?${new URLSearchParams({
            provider: 'revolut',
            transactionID: transaction.id,
            ...(transaction.customerEmail ? { customerEmail: transaction.customerEmail } : {}),
          }).toString()}`
        : undefined
      const revolutOrder = await createRevolutOrder({
        amount: typeof transaction.amount === 'number' ? transaction.amount : 0,
        currency: transaction.currency || 'EUR',
        customerEmail: transaction.customerEmail || undefined,
        description: `Ibis Electronics order ${transaction.id}`,
        redirectURL,
      })

      await payload.update({
        collection: transactionsSlug,
        id: transaction.id,
        data: {
          revolut: {
            lastEvent: 'ORDER_CREATED',
            orderId: revolutOrder.id,
            token: revolutOrder.token || revolutOrder.public_id,
            state: revolutOrder.state || 'pending',
          },
        },
        overrideAccess: true,
        req,
      })

      payload.logger.info({
        msg: 'Revolut order created',
        transactionID: transaction.id,
        revolutOrderID: revolutOrder.id,
        token: revolutOrder.token || revolutOrder.public_id,
        state: revolutOrder.state || 'pending',
      })

      return {
        checkoutURL: revolutOrder.checkout_url,
        message: 'Revolut поръчката беше създадена успешно.',
        publicId: revolutOrder.token || revolutOrder.public_id,
        revolutOrderID: revolutOrder.id,
        transactionID: transaction.id,
      }
    } catch (error) {
      payload.logger.error(
        {
          err: error,
          transactionID: transaction.id,
        },
        'Failed to create Revolut order.',
      )

      await payload.update({
        collection: transactionsSlug,
        id: transaction.id,
        data: {
          status: 'failed',
        },
        overrideAccess: true,
        req,
      })

      throw error
    }
  },
  confirmOrder: async ({ data, req }) => {
    const payload = req.payload
    const adapterData = data as RevolutAdapterData | undefined
    const checkoutData = (data || {}) as CheckoutPaymentData
    const cartSecret = typeof adapterData?.secret === 'string' ? adapterData.secret : undefined
    const transactionID = adapterData?.transactionID
    const revolutOrderID = adapterData?.revolutOrderID
    const revolutPublicID = adapterData?.revolutPublicID

    let transaction: (RevolutTransaction & { order?: unknown }) | null = null

    if (transactionID) {
      transaction = await payload.findByID({
        collection: transactionsSlug,
        depth: 1,
        id: transactionID,
        overrideAccess: true,
        req,
      })
    } else if (revolutOrderID) {
      const transactionsResult = await payload.find({
        collection: transactionsSlug,
        depth: 1,
        limit: 1,
        overrideAccess: true,
        req,
        where: {
          'revolut.orderId': {
            equals: revolutOrderID,
          },
        },
      })

      transaction = transactionsResult.docs[0]
    } else if (revolutPublicID) {
      const transactionsResult = await payload.find({
        collection: transactionsSlug,
        depth: 1,
        limit: 1,
        overrideAccess: true,
        req,
        where: {
          'revolut.token': {
            equals: revolutPublicID,
          },
        },
      })

      transaction = transactionsResult.docs[0]
    }

    if (!transaction) {
      payload.logger.warn({
        msg: 'Revolut confirm could not find transaction',
        revolutOrderID,
        revolutPublicID,
        transactionID,
      })
      throw new Error('Revolut транзакцията не беше намерена.')
    }

    const orderID = transaction.revolut?.orderId

    if (!orderID) {
      payload.logger.warn({
        msg: 'Revolut confirm found transaction without order ID',
        revolutOrderID,
        revolutPublicID,
        transactionID: transaction.id,
      })
      throw new Error('Липсва Revolut order ID за тази транзакция.')
    }

    if (
      checkoutData.deliveryMethod ||
      typeof checkoutData.shippingFee === 'number' ||
      checkoutData.econtOffice ||
      checkoutData.speedyOffice ||
      checkoutData.shippingAddress
    ) {
      let cartSnapshot: CartSnapshot | null | string | undefined = transaction.cart

      if (!cartSnapshot || typeof cartSnapshot !== 'object') {
        const cartID =
          typeof adapterData?.cartID === 'string'
            ? adapterData.cartID
            : typeof transaction.cart === 'string'
              ? transaction.cart
              : typeof transaction.cart === 'object' && transaction.cart?.id
                ? String(transaction.cart.id)
                : undefined

        if (cartID) {
          if (cartSecret) {
            req.query = req.query || {}
            req.query.secret = cartSecret
          }

          cartSnapshot = (await payload.findByID({
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
          })) as CartSnapshot
        }
      }

      if (cartSnapshot && typeof cartSnapshot === 'object' && Array.isArray(cartSnapshot.items)) {
        const refreshedSnapshot = createCheckoutTransactionData({
          cart: cartSnapshot,
          checkoutData,
          paymentMethod: 'revolut',
          user: req.user ? { email: req.user.email, id: req.user.id } : undefined,
        })

        await payload.update({
          collection: transactionsSlug,
          id: transaction.id,
          data: {
            amount: refreshedSnapshot.amount,
            billingAddress: refreshedSnapshot.billingAddress,
            ...(refreshedSnapshot.customerEmail ? { customerEmail: refreshedSnapshot.customerEmail } : {}),
            customerNotes: refreshedSnapshot.customerNotes,
            deliveryMethod: refreshedSnapshot.deliveryMethod,
            econtOfficeAddress: refreshedSnapshot.econtOfficeAddress,
            econtOfficeCode: refreshedSnapshot.econtOfficeCode,
            econtOfficeId: refreshedSnapshot.econtOfficeId,
            econtOfficeName: refreshedSnapshot.econtOfficeName,
            shippingAddress: refreshedSnapshot.shippingAddress,
            shippingFee: refreshedSnapshot.shippingFee,
            speedyOfficeAddress: refreshedSnapshot.speedyOfficeAddress,
            speedyOfficeId: refreshedSnapshot.speedyOfficeId,
            speedyOfficeName: refreshedSnapshot.speedyOfficeName,
          },
          overrideAccess: true,
          req,
        })

        transaction = {
          ...transaction,
          ...refreshedSnapshot,
        }

        payload.logger.info({
          msg: 'Revolut confirm refreshed checkout snapshot',
          transactionID: transaction.id,
          customerEmail: refreshedSnapshot.customerEmail || null,
          deliveryMethod: refreshedSnapshot.deliveryMethod || null,
          shippingFee: refreshedSnapshot.shippingFee ?? null,
          speedyOfficeAddress: refreshedSnapshot.speedyOfficeAddress || null,
          speedyOfficeName: refreshedSnapshot.speedyOfficeName || null,
          econtOfficeAddress: refreshedSnapshot.econtOfficeAddress || null,
          econtOfficeName: refreshedSnapshot.econtOfficeName || null,
        })
      }
    }

    let revolutOrder = await retrieveRevolutOrder(orderID)
    payload.logger.info({
      msg: 'Revolut confirm initial state',
      revolutOrderID: orderID,
      state: revolutOrder.state || 'pending',
      transactionID: transaction.id,
    })

    for (
      let attempt = 1;
      !isRevolutSuccessState(revolutOrder.state) && attempt < REVOLUT_CONFIRM_MAX_ATTEMPTS;
      attempt += 1
    ) {
      await wait(REVOLUT_CONFIRM_RETRY_DELAY_MS)
      revolutOrder = await retrieveRevolutOrder(orderID)
      payload.logger.info({
        attempt,
        msg: 'Revolut confirm polled state',
        revolutOrderID: orderID,
        state: revolutOrder.state || 'pending',
        transactionID: transaction.id,
      })
    }

    await payload.update({
      collection: transactionsSlug,
      id: transaction.id,
      data: {
        revolut: {
          ...transaction.revolut,
          state: revolutOrder.state || transaction.revolut?.state || 'pending',
        },
      },
      overrideAccess: true,
      req,
    })

    if (!isRevolutSuccessState(revolutOrder.state)) {
      payload.logger.warn({
        msg: 'Revolut order is still not confirmed after polling window',
        revolutOrderID: orderID,
        state: revolutOrder.state || 'pending',
        transactionID: transaction.id,
      })
      throw new Error('Плащането с Revolut все още не е потвърдено.')
    }

    payload.logger.info({
      msg: 'Revolut confirm accepted successful state',
      revolutOrderID: orderID,
      state: revolutOrder.state,
      transactionID: transaction.id,
    })

    return finalizeCheckoutTransaction({
      req,
      transactionID: transaction.id,
    })
  },
  endpoints: [
    {
      path: '/webhooks',
      method: 'post',
      handler: async (req) => {
        const signingSecret = process.env.REVOLUT_WEBHOOK_SIGNING_SECRET
        const timestamp = req.headers.get('Revolut-Request-Timestamp')
        const signatureHeader = req.headers.get('Revolut-Signature')

        if (!req.text) {
          return Response.json({ received: false, message: 'Raw body reader is unavailable.' }, { status: 400 })
        }

        const rawBody = await req.text()

        if (!signingSecret || !timestamp || !signatureHeader) {
          return Response.json({ received: false, message: 'Missing Revolut webhook configuration.' }, { status: 400 })
        }

        const isValid = verifyRevolutWebhookSignature({
          rawBody,
          signatureHeader,
          signingSecret,
          timestamp,
        })

        if (!isValid) {
          return Response.json({ received: false, message: 'Invalid Revolut signature.' }, { status: 400 })
        }

        const webhookPayload = JSON.parse(rawBody) as RevolutWebhookPayload
        const orderID = webhookPayload.order_id

        if (!orderID) {
          return Response.json({ received: true, skipped: true })
        }

        const transactionsResult = await req.payload.find({
          collection: transactionsSlug,
          depth: 1,
          limit: 1,
          overrideAccess: true,
          req,
          where: {
            'revolut.orderId': {
              equals: orderID,
            },
          },
        })

        const transaction = transactionsResult.docs[0] as RevolutTransaction | undefined

        if (!transaction) {
          return Response.json({ received: true, skipped: true })
        }

        const nextStatus = mapRevolutEventToTransactionStatus(webhookPayload.event)
        const nextState =
          webhookPayload.event === 'ORDER_AUTHORISED'
            ? 'authorised'
            : webhookPayload.event === 'ORDER_COMPLETED'
              ? 'completed'
              : webhookPayload.event === 'ORDER_CANCELLED'
                ? 'cancelled'
                : webhookPayload.event === 'ORDER_FAILED'
                  ? 'failed'
                  : transaction.revolut?.state || 'pending'

        await req.payload.update({
          collection: transactionsSlug,
          id: transaction.id,
          data: {
            revolut: {
              ...transaction.revolut,
              lastEvent: webhookPayload.event || transaction.revolut?.lastEvent,
              state: nextState,
            },
            status: nextStatus,
          },
          overrideAccess: true,
          req,
        })

        if (nextStatus === 'succeeded') {
          await finalizeCheckoutTransaction({
            req,
            transactionID: transaction.id,
          })
        }

        return Response.json({ received: true })
      },
    },
  ],
})

export const revolutAdapterClient = (): PaymentAdapterClient => ({
  name: 'revolut',
  label: 'Revolut Pay',
  confirmOrder: true,
  initiatePayment: true,
})
