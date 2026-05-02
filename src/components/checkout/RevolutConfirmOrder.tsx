'use client'

import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { useCart, useEcommerce } from '@payloadcms/plugin-ecommerce/client/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

const REVOLUT_PENDING_TRANSACTION_KEY = 'ibis-pending-revolut-transaction'
const REVOLUT_PENDING_EMAIL_KEY = 'ibis-pending-revolut-email'
const REVOLUT_PENDING_CART_ID_KEY = 'ibis-pending-revolut-cart-id'
const REVOLUT_PENDING_CART_SECRET_KEY = 'ibis-pending-revolut-cart-secret'
const REVOLUT_PENDING_CHECKOUT_DATA_KEY = 'ibis-pending-revolut-checkout-data'

export const RevolutConfirmOrder: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const { clearSession } = useEcommerce()
  const [error, setError] = useState<string | null>(null)
  const hasStartedConfirmationRef = useRef(false)

  useEffect(() => {
    const provider = searchParams.get('provider')
    const cartID = localStorage.getItem(REVOLUT_PENDING_CART_ID_KEY) || ''
    const cartSecret = localStorage.getItem(REVOLUT_PENDING_CART_SECRET_KEY) || ''
    const storedCheckoutDataRaw = localStorage.getItem(REVOLUT_PENDING_CHECKOUT_DATA_KEY)
    const result = searchParams.get('result')
    const customerEmailFromQuery = searchParams.get('customerEmail') || ''
    const revolutPublicID = searchParams.get('_rp_oid') || undefined
    const revolutSuccess = searchParams.get('_rp_s')
    const revolutFailure = searchParams.get('_rp_fr')
    const transactionID =
      searchParams.get('transactionID') || localStorage.getItem(REVOLUT_PENDING_TRANSACTION_KEY)
    const email = localStorage.getItem(REVOLUT_PENDING_EMAIL_KEY) || customerEmailFromQuery || ''
    const hasPendingRevolutTransaction = Boolean(transactionID)
    const isHostedRevolutReturn = Boolean(
      revolutPublicID || revolutSuccess || revolutFailure || hasPendingRevolutTransaction,
    )

    console.log('[Revolut confirm page params]', {
      hasCheckoutData: Boolean(storedCheckoutDataRaw),
      hasEmail: Boolean(email),
      hasPendingRevolutTransaction,
      hasStoredCart: Boolean(cartID),
      provider,
      result,
      revolutFailure,
      revolutPublicID,
      revolutSuccess,
      transactionID,
    })

    if (provider !== 'revolut' && !isHostedRevolutReturn) {
      router.replace('/checkout')
      return
    }

    if (result === 'cancel') {
      setError('Плащането с Revolut беше прекъснато.')
      return
    }

    if (result === 'failure') {
      setError('Revolut върна неуспешен резултат за плащането.')
      return
    }

    if (revolutFailure) {
      setError('Revolut върна неуспешен резултат за плащането.')
      return
    }

    if (email) {
      localStorage.setItem(REVOLUT_PENDING_EMAIL_KEY, email)
    }

    if (transactionID) {
      localStorage.setItem(REVOLUT_PENDING_TRANSACTION_KEY, transactionID)
    }

    const hasSuccessfulReturn =
      result === 'success' ||
      Boolean(revolutSuccess) ||
      (provider === 'revolut' && hasPendingRevolutTransaction)

    if (!hasSuccessfulReturn) {
      router.replace('/checkout')
      return
    }

    if (!transactionID && !revolutPublicID) {
      setError('Липсва локален запис за Revolut транзакцията. Върни се в checkout-а и опитай отново.')
      return
    }

    if (hasStartedConfirmationRef.current) {
      return
    }

    hasStartedConfirmationRef.current = true

    const finishRevolutOrder = async () => {
      try {
        const storedCheckoutData = storedCheckoutDataRaw ? JSON.parse(storedCheckoutDataRaw) : {}
        const response = await fetch('/api/payments/revolut/confirm-order', {
          body: JSON.stringify({
            ...(cartID ? { cartID } : {}),
            ...(cartSecret ? { secret: cartSecret } : {}),
            ...(email ? { customerEmail: email } : {}),
            ...(revolutPublicID ? { revolutPublicID } : {}),
            ...storedCheckoutData,
            transactionID,
          }),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })

        if (!response.ok) {
          const responseError = await response.text()
          throw new Error(responseError)
        }

        const confirmResult = await response.json()

        console.log('[Revolut confirm result]', confirmResult)

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

        if (email) {
          queryParams.set('email', email)
        }

        if (accessToken) {
          queryParams.set('accessToken', accessToken)
        }

        localStorage.removeItem(REVOLUT_PENDING_TRANSACTION_KEY)
        localStorage.removeItem(REVOLUT_PENDING_EMAIL_KEY)
        localStorage.removeItem(REVOLUT_PENDING_CART_ID_KEY)
        localStorage.removeItem(REVOLUT_PENDING_CART_SECRET_KEY)
        localStorage.removeItem(REVOLUT_PENDING_CHECKOUT_DATA_KEY)
        await clearCart()
        clearSession()
        router.replace(
          `/orders/${String(confirmResult.orderID)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
        )
        router.refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Неуспешно потвърждаване на Revolut плащането.'
        console.error('[Revolut confirm error]', err)
        setError(msg)
      }
    }

    void finishRevolutOrder()
  }, [clearCart, clearSession, router, searchParams])

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-xl rounded-[12px] border border-black/8 bg-white px-6 py-8">
        {error ? (
          <>
            <Message error={error} />
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link href="/checkout">Обратно към checkout</Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-base text-primary/70">Потвърждаваме плащането с Revolut...</p>
        )}
      </div>
    </div>
  )
}
