'use client'

import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import React, { useCallback, FormEvent, useMemo, useRef } from 'react'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { Address } from '@/payload-types'

type Props = {
  customerEmail?: string
  customerNotes?: string
  billingAddress?: Partial<Address>
  disabled?: boolean
  deliveryMethod: 'address' | 'speedy-office' | 'econt-office'
  econtOffice?: {
    address: string
    cityId: string
    cityName: string
    code: string
    id: string
    name: string
    regionId: string
    regionName: string
  } | null
  shippingFee: number
  shippingAddress?: Partial<Address>
  speedyOffice?: {
    address: string
    id: string
    name: string
    siteId: string
    siteName: string
    stateId: string
    stateName: string
  } | null
  setProcessingPayment: React.Dispatch<React.SetStateAction<boolean>>
  revolutPayEnabled?: boolean
  totalAmount: number
}

const REVOLUT_PENDING_TRANSACTION_KEY = 'ibis-pending-revolut-transaction'
const REVOLUT_PENDING_EMAIL_KEY = 'ibis-pending-revolut-email'
const REVOLUT_PENDING_CART_ID_KEY = 'ibis-pending-revolut-cart-id'
const REVOLUT_PENDING_CART_SECRET_KEY = 'ibis-pending-revolut-cart-secret'
const REVOLUT_PENDING_CHECKOUT_DATA_KEY = 'ibis-pending-revolut-checkout-data'

export const CheckoutForm: React.FC<Props> = ({
  customerEmail,
  customerNotes,
  billingAddress,
  disabled = false,
  deliveryMethod,
  econtOffice,
  shippingFee,
  shippingAddress,
  speedyOffice,
  setProcessingPayment,
  revolutPayEnabled = false,
}) => {
  const [error, setError] = React.useState<null | string>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [paymentMethod, setPaymentMethod] = React.useState<'manual' | 'revolut'>(
    revolutPayEnabled ? 'revolut' : 'manual',
  )
  const router = useRouter()
  const { cart, clearCart } = useCart()
  const { confirmOrder, initiatePayment } = usePayments()
  const pendingTransactionIDRef = useRef<string | null>(null)
  const guestEmailRef = useRef(`guest-${Date.now()}@orders.ibiselectronics.local`)
  const trimmedCustomerEmail = customerEmail?.trim() || ''
  const effectiveCustomerEmail = trimmedCustomerEmail || guestEmailRef.current

  const checkoutAdditionalData = useMemo(
    () => ({
      billingAddress,
      customerEmail: effectiveCustomerEmail,
      customerNotes: customerNotes?.trim() || undefined,
      deliveryMethod,
      ...(deliveryMethod === 'econt-office' && econtOffice ? { econtOffice } : {}),
      shippingFee,
      ...(deliveryMethod === 'speedy-office' && speedyOffice ? { speedyOffice } : {}),
      ...(shippingAddress ? { shippingAddress } : {}),
    }),
    [
      billingAddress,
      customerNotes,
      deliveryMethod,
      econtOffice,
      effectiveCustomerEmail,
      shippingFee,
      shippingAddress,
      speedyOffice,
    ],
  )

  const redirectToOrder = useCallback(
    async (confirmResult: unknown) => {
      if (
        !confirmResult ||
        typeof confirmResult !== 'object' ||
        !('orderID' in confirmResult) ||
        !confirmResult.orderID
      ) {
        throw new Error('Липсва идентификатор на поръчката.')
      }

      const queryParams = new URLSearchParams()
      const accessToken =
        'accessToken' in confirmResult && typeof confirmResult.accessToken === 'string'
          ? confirmResult.accessToken
          : ''

      if (trimmedCustomerEmail) {
        queryParams.set('email', trimmedCustomerEmail)
      }

      if (accessToken) {
        queryParams.set('accessToken', accessToken)
      }

      localStorage.removeItem(REVOLUT_PENDING_TRANSACTION_KEY)
      localStorage.removeItem(REVOLUT_PENDING_EMAIL_KEY)
      pendingTransactionIDRef.current = null
      clearCart()
      router.push(
        `/orders/${String(confirmResult.orderID)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      )
    },
    [clearCart, router, trimmedCustomerEmail],
  )

  const handleManualSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setIsLoading(true)
      setProcessingPayment(true)

      try {
        const confirmResult = await confirmOrder('manual', {
          additionalData: checkoutAdditionalData,
        })
        await redirectToOrder(confirmResult)
        return
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Възникна неочакван проблем.'
        setError(`Грешка при изпращането на поръчката: ${msg}`)
      }

      setIsLoading(false)
      setProcessingPayment(false)
    },
    [checkoutAdditionalData, confirmOrder, redirectToOrder, setProcessingPayment],
  )

  const handleRevolutRedirect = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    setProcessingPayment(true)

    if (disabled) {
      setIsLoading(false)
      setProcessingPayment(false)
      setError('Попълни необходимите данни за контакт и доставка преди плащане.')
      return
    }

    try {
      const result = await initiatePayment('revolut', {
        additionalData: checkoutAdditionalData,
      })

      console.log('[Revolut initiate result]', result)

      if (
        !result ||
        typeof result !== 'object' ||
        !('checkoutURL' in result) ||
        typeof result.checkoutURL !== 'string' ||
        !result.checkoutURL ||
        !('transactionID' in result) ||
        typeof result.transactionID !== 'string'
      ) {
        throw new Error('Revolut не върна валиден checkout URL.')
      }

      pendingTransactionIDRef.current = result.transactionID
      localStorage.setItem(REVOLUT_PENDING_TRANSACTION_KEY, result.transactionID)
      localStorage.setItem(REVOLUT_PENDING_EMAIL_KEY, effectiveCustomerEmail)
      if (cart?.id) {
        localStorage.setItem(REVOLUT_PENDING_CART_ID_KEY, String(cart.id))
      }
      if (cart?.secret) {
        localStorage.setItem(REVOLUT_PENDING_CART_SECRET_KEY, String(cart.secret))
      }
      localStorage.setItem(REVOLUT_PENDING_CHECKOUT_DATA_KEY, JSON.stringify(checkoutAdditionalData))

      window.location.href = result.checkoutURL
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Възникна проблем при стартирането на Revolut плащането.'
      setError(msg)
      setIsLoading(false)
      setProcessingPayment(false)
    }
  }, [cart?.id, cart?.secret, checkoutAdditionalData, disabled, initiatePayment, setProcessingPayment])

  return (
    <form onSubmit={handleManualSubmit}>
      {error && <Message error={error} />}

      {revolutPayEnabled ? (
        <div className="mt-8 rounded-[10px] border border-black/8 bg-white px-5 py-5">
          <p className="type-subsection-title text-primary/85">Начин на плащане</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              className={`rounded-[10px] border px-4 py-3 text-left transition ${
                paymentMethod === 'manual'
                  ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                  : 'border-black/8 bg-white hover:border-black/15'
              }`}
              onClick={(event) => {
                event.preventDefault()
                setPaymentMethod('manual')
              }}
              type="button"
            >
              <p className="type-subsection-title text-primary/85">Заявка за поръчка</p>
              <p className="mt-1 text-sm text-primary/60">Поръчката се изпраща за ръчна обработка.</p>
            </button>

            <button
              className={`rounded-[10px] border px-4 py-3 text-left transition ${
                paymentMethod === 'revolut'
                  ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                  : 'border-black/8 bg-white hover:border-black/15'
              }`}
              onClick={(event) => {
                event.preventDefault()
                setPaymentMethod('revolut')
              }}
              type="button"
            >
              <p className="type-subsection-title text-primary/85">Плащане онлайн</p>
              <p className="mt-1 text-sm text-primary/60">
                Ще бъдеш пренасочен към защитена страница за онлайн плащане.
              </p>
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        {paymentMethod === 'manual' ? (
          <Button
            className="h-12 rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
            disabled={disabled || isLoading}
            type="submit"
            variant="default"
          >
            {isLoading ? 'Изпраща се...' : 'Изпрати поръчката'}
          </Button>
        ) : (
          <>
            <div className="text-sm text-primary/60">
              След натискане ще бъдеш пренасочен към защитена платежна страница.
            </div>
            <Button
              className="h-12 rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
              disabled={disabled || isLoading}
              onClick={(event) => {
                event.preventDefault()
                void handleRevolutRedirect()
              }}
              type="button"
              variant="default"
            >
              {isLoading ? 'Пренасочване към плащане...' : 'Плати онлайн'}
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
