import type { PaymentAdapter, PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'
import { addDataAndFileToRequest } from 'payload'
import type { Field, PayloadRequest } from 'payload'
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
  additionalData?: CheckoutPaymentData
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

const extractCheckoutData = (...candidates: Array<RevolutAdapterData | undefined>): CheckoutPaymentData => {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    if (candidate.additionalData && typeof candidate.additionalData === 'object') {
      return candidate.additionalData
    }

    if (
      candidate.deliveryMethod ||
      candidate.boxNowLocker ||
      candidate.econtOffice ||
      candidate.speedyOffice ||
      candidate.customerNotes ||
      typeof candidate.shippingFee === 'number'
    ) {
      return candidate as CheckoutPaymentData
    }
  }

  return {}
}

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

const findRevolutTransaction = async ({
  adapterData,
  req,
}: {
  adapterData?: RevolutAdapterData
  req: PayloadRequest
}) => {
  const payload = req.payload
  const transactionID = adapterData?.transactionID
  const revolutOrderID = adapterData?.revolutOrderID
  const revolutPublicID = adapterData?.revolutPublicID

  if (transactionID) {
    return (await payload.findByID({
      collection: transactionsSlug,
      depth: 1,
      id: transactionID,
      overrideAccess: true,
      req,
    })) as (RevolutTransaction & { order?: unknown }) | null
  }

  if (revolutOrderID) {
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

    return transactionsResult.docs[0] as (RevolutTransaction & { order?: unknown }) | undefined
  }

  if (revolutPublicID) {
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

    return transactionsResult.docs[0] as (RevolutTransaction & { order?: unknown }) | undefined
  }

  return null
}

const resolveRevolutTransaction = async ({
  adapterData,
  req,
}: {
  adapterData?: RevolutAdapterData
  req: PayloadRequest
}) => {
  const payload = req.payload
  const checkoutData = extractCheckoutData(adapterData)
  const cartSecret = typeof adapterData?.secret === 'string' ? adapterData.secret : undefined
  const revolutOrderID = adapterData?.revolutOrderID
  const revolutPublicID = adapterData?.revolutPublicID
  const transactionID = adapterData?.transactionID

  const transaction = await findRevolutTransaction({ adapterData, req })

  if (!transaction) {
    payload.logger.warn({
      msg: 'Revolut confirm could not find transaction',
      revolutOrderID,
      revolutPublicID,
      transactionID,
    })
    throw new Error('Revolut транзакцията не беше намерена.')
  }

  let resolvedTransaction = transaction

  if (resolvedTransaction.order) {
    return finalizeCheckoutTransaction({
      req,
      transactionID: resolvedTransaction.id,
    })
  }

  const orderID = resolvedTransaction.revolut?.orderId

  if (!orderID) {
    payload.logger.warn({
      msg: 'Revolut confirm found transaction without order ID',
      revolutOrderID,
      revolutPublicID,
      transactionID: resolvedTransaction.id,
    })
    throw new Error('Липсва Revolut order ID за тази транзакция.')
  }

  if (
    checkoutData.deliveryMethod ||
    typeof checkoutData.shippingFee === 'number' ||
    checkoutData.boxNowLocker ||
    checkoutData.econtOffice ||
    checkoutData.speedyOffice ||
    checkoutData.shippingAddress
  ) {
    let cartSnapshot: CartSnapshot | null | string | undefined = resolvedTransaction.cart

    if (!cartSnapshot || typeof cartSnapshot !== 'object') {
      const cartID =
        typeof adapterData?.cartID === 'string'
          ? adapterData.cartID
          : typeof resolvedTransaction.cart === 'string'
            ? resolvedTransaction.cart
            : typeof resolvedTransaction.cart === 'object' && resolvedTransaction.cart?.id
              ? String(resolvedTransaction.cart.id)
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
        id: resolvedTransaction.id,
        data: {
          amount: refreshedSnapshot.amount,
          billingAddress: refreshedSnapshot.billingAddress,
          ...(refreshedSnapshot.customerEmail ? { customerEmail: refreshedSnapshot.customerEmail } : {}),
          boxNowLockerAddress: refreshedSnapshot.boxNowLockerAddress,
          boxNowLockerId: refreshedSnapshot.boxNowLockerId,
          boxNowLockerName: refreshedSnapshot.boxNowLockerName,
          boxNowLockerPostalCode: refreshedSnapshot.boxNowLockerPostalCode,
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

        resolvedTransaction = {
          ...resolvedTransaction,
          ...refreshedSnapshot,
        }

        payload.logger.info({
          msg: 'Revolut confirm refreshed checkout snapshot',
          transactionID: resolvedTransaction.id,
          customerEmail: refreshedSnapshot.customerEmail || null,
          deliveryMethod: refreshedSnapshot.deliveryMethod || null,
          boxNowLockerAddress: refreshedSnapshot.boxNowLockerAddress || null,
          boxNowLockerName: refreshedSnapshot.boxNowLockerName || null,
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
    transactionID: resolvedTransaction.id,
  })

  for (
    let attempt = 1;
    !isRevolutSuccessState(revolutOrder.state) && attempt < REVOLUT_CONFIRM_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const currentTransactionID = resolvedTransaction.id

    await wait(REVOLUT_CONFIRM_RETRY_DELAY_MS)
    revolutOrder = await retrieveRevolutOrder(orderID)
    payload.logger.info({
      attempt,
      msg: 'Revolut confirm polled state',
      revolutOrderID: orderID,
      state: revolutOrder.state || 'pending',
      transactionID: currentTransactionID,
    })

    const refreshedTransaction = await findRevolutTransaction({
      adapterData: {
        transactionID: currentTransactionID,
      },
      req,
    })

    if (refreshedTransaction) {
      resolvedTransaction = refreshedTransaction
    }

    if (resolvedTransaction.order) {
      return finalizeCheckoutTransaction({
        req,
        transactionID: resolvedTransaction.id,
      })
    }
  }

  const latestTransaction =
    (await findRevolutTransaction({
      adapterData: {
        transactionID: resolvedTransaction.id,
      },
      req,
    })) || resolvedTransaction

  resolvedTransaction = latestTransaction

  if (resolvedTransaction.order) {
    return finalizeCheckoutTransaction({
      req,
      transactionID: resolvedTransaction.id,
    })
  }

  await payload.update({
    collection: transactionsSlug,
    id: resolvedTransaction.id,
    data: {
      revolut: {
        ...resolvedTransaction.revolut,
        state: revolutOrder.state || resolvedTransaction.revolut?.state || 'pending',
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
      transactionID: resolvedTransaction.id,
    })
    throw new Error('Плащането с Revolut все още не е потвърдено.')
  }

  payload.logger.info({
    msg: 'Revolut confirm accepted successful state',
    revolutOrderID: orderID,
    state: revolutOrder.state,
    transactionID: resolvedTransaction.id,
  })

  return finalizeCheckoutTransaction({
    req,
    transactionID: resolvedTransaction.id,
  })
}

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
    const requestData = (req.data || {}) as RevolutAdapterData
    const checkoutData = extractCheckoutData(requestData, adapterData)
    const cart = adapterData?.cart

    payload.logger.info({
      msg: 'Revolut initiate received checkout data',
      customerEmail: checkoutData.customerEmail || null,
      deliveryMethod: checkoutData.deliveryMethod || null,
      boxNowLockerAddress:
        checkoutData.boxNowLocker && typeof checkoutData.boxNowLocker.address === 'string'
          ? checkoutData.boxNowLocker.address
          : null,
      boxNowLockerName:
        checkoutData.boxNowLocker && typeof checkoutData.boxNowLocker.name === 'string'
          ? checkoutData.boxNowLocker.name
          : null,
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
      boxNowLockerAddress: transaction.boxNowLockerAddress || null,
      boxNowLockerName: transaction.boxNowLockerName || null,
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
    return resolveRevolutTransaction({
      adapterData: data as RevolutAdapterData | undefined,
      req,
    })
  },
  endpoints: [
    {
      path: '/confirm-return',
      method: 'post',
      handler: async (req) => {
        await addDataAndFileToRequest(req)

        try {
          const paymentResponse = await resolveRevolutTransaction({
            adapterData: req.data as RevolutAdapterData | undefined,
            req,
          })

          return Response.json(paymentResponse)
        } catch (error) {
          req.payload.logger.error(error, 'Error confirming Revolut return.')

          return Response.json(
            {
              message: error instanceof Error ? error.message : 'Error confirming Revolut return.',
            },
            {
              status: 500,
            },
          )
        }
      },
    },
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
