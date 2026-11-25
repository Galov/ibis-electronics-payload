'use client'
import { useLocale } from '@/i18n/provider'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { useLocalizedRouter } from '@/i18n/navigation'

import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import React, { useCallback, FormEvent, useMemo, useRef } from 'react'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import type { CompanyInvoice } from '@/ecommerce/companyInvoice'
import { Address } from '@/payload-types'

type Props = {
  onlineOnly?: boolean
  companyInvoice?: CompanyInvoice | null
  customerEmail?: string
  customerNotes?: string
  billingAddress?: Partial<Address>
  disabled?: boolean
  deliveryMethod: 'address' | 'boxnow' | 'speedy-office' | 'econt-office'
  boxNowLocker?: {
    address: string
    id: string
    latitude: string
    longitude: string
    name: string
    postalCode: string
  } | null
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
  companyInvoice,
  customerEmail,
  customerNotes,
  billingAddress,
  boxNowLocker,
  disabled = false,
  deliveryMethod,
  econtOffice,
  shippingFee,
  shippingAddress,
  speedyOffice,
  setProcessingPayment,
  revolutPayEnabled = false,
  onlineOnly = false,
}) => {
  const locale = useLocale()
  const ui = useCommerceTranslation()

  const [error, setError] = React.useState<null | string>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [paymentMethod, setPaymentMethod] = React.useState<'manual' | 'revolut'>(
    revolutPayEnabled || onlineOnly ? 'revolut' : 'manual',
  )
  const router = useLocalizedRouter()
  const { cart, clearCart } = useCart()
  const { confirmOrder, initiatePayment } = usePayments()
  const pendingTransactionIDRef = useRef<string | null>(null)
  const guestEmailRef = useRef(`guest-${Date.now()}@orders.ibiselectronics.local`)
  const trimmedCustomerEmail = customerEmail?.trim() || ''
  const effectiveCustomerEmail = trimmedCustomerEmail || guestEmailRef.current

  const checkoutAdditionalData = useMemo(
    () => ({
      locale,
      billingAddress,
      companyInvoice,
      customerEmail: effectiveCustomerEmail,
      customerNotes: customerNotes?.trim() || undefined,
      deliveryMethod,
      ...(deliveryMethod === 'boxnow' && boxNowLocker ? { boxNowLocker } : {}),
      ...(deliveryMethod === 'econt-office' && econtOffice ? { econtOffice } : {}),
      shippingFee,
      ...(deliveryMethod === 'speedy-office' && speedyOffice ? { speedyOffice } : {}),
      ...(shippingAddress ? { shippingAddress } : {}),
    }),
    [
      locale,
      billingAddress,
      companyInvoice,
      boxNowLocker,
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
        throw new Error(ui('Липсва идентификатор на поръчката.'))
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
    [clearCart, router, trimmedCustomerEmail, ui],
  )

  const handleManualSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (disabled || isLoading || onlineOnly) return
      setIsLoading(true)
      setProcessingPayment(true)

      try {
        const confirmResult = await confirmOrder('manual', {
          additionalData: checkoutAdditionalData,
        })
        await redirectToOrder(confirmResult)
        return
      } catch (err) {
        const msg = err instanceof Error ? ui(err.message) : ui('Възникна неочакван проблем.')
        setError(ui(ui('Грешка при изпращането на поръчката: {0}'), { 0: msg }))
      }

      setIsLoading(false)
      setProcessingPayment(false)
    },
    [
      checkoutAdditionalData,
      onlineOnly,
      confirmOrder,
      disabled,
      isLoading,
      redirectToOrder,
      setProcessingPayment,
      ui,
    ],
  )

  const handleRevolutRedirect = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    setProcessingPayment(true)

    if (disabled || !revolutPayEnabled) {
      setIsLoading(false)
      setProcessingPayment(false)
      setError(ui('Попълни необходимите данни за контакт и доставка преди плащане.'))
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
        throw new Error(ui('Revolut не върна валиден checkout URL.'))
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
      const { companyInvoice: _companyInvoice, ...returnCheckoutData } = checkoutAdditionalData
      localStorage.setItem(REVOLUT_PENDING_CHECKOUT_DATA_KEY, JSON.stringify(returnCheckoutData))

      window.location.href = result.checkoutURL
    } catch (err) {
      const msg =
        err instanceof Error
          ? ui(err.message)
          : ui('Възникна проблем при стартирането на Revolut плащането.')
      setError(msg)
      setIsLoading(false)
      setProcessingPayment(false)
    }
  }, [
    cart?.id,
    cart?.secret,
    checkoutAdditionalData,
    disabled,
    revolutPayEnabled,
    effectiveCustomerEmail,
    initiatePayment,
    setProcessingPayment,
    ui,
  ])

  return (
    <form onSubmit={handleManualSubmit}>
      {error && <Message error={error} />}

      {revolutPayEnabled && !onlineOnly ? (
        <div className="mt-8 rounded-[10px] border border-black/8 bg-white px-5 py-5">
          <p className="type-subsection-title text-primary/85">
            <CommerceText source={'Начин на плащане'} />
          </p>
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
              <p className="type-subsection-title text-primary/85">
                <CommerceText source={'Наложен платеж'} />
              </p>
              <p className="mt-1 text-sm text-primary/60">
                <CommerceText source={'Поръчката се изпраща за ръчна обработка.'} />
              </p>
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
              <p className="type-subsection-title text-primary/85">
                <CommerceText source={'Плащане онлайн'} />
              </p>
              <p className="mt-1 text-sm text-primary/60">
                <CommerceText
                  source={'Ще бъдеш пренасочен към защитена страница за онлайн плащане.'}
                />{' '}
              </p>
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        {paymentMethod === 'manual' && !onlineOnly ? (
          <Button
            className="h-12 rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
            disabled={disabled || isLoading || (onlineOnly && !revolutPayEnabled)}
            type="submit"
            variant="default"
          >
            {isLoading ? ui('Изпраща се...') : ui('Изпрати поръчката')}
          </Button>
        ) : (
          <>
            <div className="text-sm text-primary/60">
              <CommerceText
                source={'След натискане ще бъдеш пренасочен към защитена платежна страница.'}
              />{' '}
            </div>
            <Button
              className="h-12 rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
              disabled={disabled || isLoading || (onlineOnly && !revolutPayEnabled)}
              onClick={(event) => {
                event.preventDefault()
                void handleRevolutRedirect()
              }}
              type="button"
              variant="default"
            >
              {isLoading ? ui('Пренасочване към плащане...') : ui('Плати онлайн')}
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
