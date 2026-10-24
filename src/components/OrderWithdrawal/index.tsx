'use client'
import { useLocale } from '@/i18n/provider'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { useLocalizedRouter } from '@/i18n/navigation'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReturnCostNotice } from '@/components/ReturnCostNotice'

export function OrderWithdrawal({
  orderID,
  token,
  requestedAt,
  closed = false,
}: {
  orderID?: string
  token?: string
  requestedAt?: string | null
  closed?: boolean
}) {
  const ui = useCommerceTranslation()

  const router = useLocalizedRouter()
  const [confirming, setConfirming] = useState(Boolean(token && !orderID))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  if (requestedAt)
    return (
      <p role="status" className="text-sm leading-6">
        <CommerceText
          source={'Отказът от поръчката е записан. Ибис Електроникс ще обработи случая.'}
        />{' '}
      </p>
    )
  if (closed)
    return (
      <p className="text-sm">
        <CommerceText source={'Поръчката вече е отменена или сумата е възстановена.'} />
      </p>
    )

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/order-withdrawal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID, token, confirmed: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || ui('Отказът не е записан.'))
      setMessage(
        result.status === 'cancelled'
          ? ui(
              'Поръчката е отменена. Ако отказът е записан сега, ще получите потвърждение по имейл.',
            )
          : ui(
              'Отказът е записан. Ще получите потвърждение по имейл, а Ибис Електроникс ще ви информира за следващите стъпки.',
            ),
      )
      setDone(true)
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : ui('Опитайте отново или се свържете с Ибис Електроникс.'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-[10px] border border-black/10 bg-white p-5">
      <h2 className="type-section-title">
        <CommerceText source={'Отказ от поръчка'} />
      </h2>
      {done ? (
        <p role="status">{message}</p>
      ) : confirming ? (
        <>
          <p className="text-sm leading-6">
            <CommerceText
              source={
                'Потвърдете, че искате да се откажете от цялата поръчка. Ако тя вече е обработена или изпратена, Ибис Електроникс ще уреди необходимите стъпки за връщане и, когато е приложимо, възстановяване на сумата.'
              }
            />{' '}
          </p>
          <div className="text-sm leading-6 text-primary/70">
            <ReturnCostNotice />
          </div>
          <p className="text-sm leading-6">
            <CommerceText
              source={
                'Потвърждението записва заявения отказ. То не потвърждава получаването на върнатите стоки или възстановяването на сумата.'
              }
            />{' '}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={() => void submit()}>
              {busy ? ui('Записва се...') : ui('Потвърждавам отказа')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              <CommerceText source={'Назад'} />{' '}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-6">
            <CommerceText
              source={
                'Можете да отмените поръчката преди обработка или да заявите отказ, ако тя вече е обработена. Законовият срок за отказ по общото правило е 14 дни от получаването на стоката, а не от поръчването. Ибис Електроникс ще провери случая и приложимите законови изключения.'
              }
            />{' '}
          </p>
          <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
            <CommerceText source={'Откажи поръчката'} />{' '}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          <CommerceText source={error} error />
        </p>
      )}
    </section>
  )
}

export function GuestWithdrawalForm() {
  const locale = useLocale()
  const ui = useCommerceTranslation()

  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      className="max-w-lg space-y-5"
      onSubmit={async (event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        setBusy(true)
        setError('')
        try {
          const response = await fetch('/api/order-withdrawal/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderID: data.get('orderID'),
              email: data.get('email'),
              ...(locale === 'en' ? { locale } : {}),
            }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || ui('Опитайте отново.'))
          setSent(true)
        } catch (error) {
          setError(error instanceof Error ? error.message : ui('Опитайте отново.'))
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm leading-6">
        <CommerceText
          source={
            'Въведете номера на поръчката и имейла, използван при покупката. Ще получите линк за потвърждение. Самото изпращане на тази форма не отменя поръчката.'
          }
        />{' '}
      </p>
      <div className="text-sm leading-6 text-primary/70">
        <ReturnCostNotice />
      </div>
      {sent ? (
        <p role="status">
          <CommerceText
            source={
              'Ако данните съответстват на поръчка, изпратихме линк по имейл. Проверете и папката Спам. Линкът е валиден 24 часа. Ако съобщението не пристигне, свържете се с Ибис Електроникс; можете да заявите отказа и по имейл.'
            }
          />{' '}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-order">
              <CommerceText source={'Номер на поръчката'} />
            </Label>
            <Input
              id="withdrawal-order"
              name="orderID"
              required
              maxLength={24}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-email">
              <CommerceText source={'Имейлът, използван при поръчката'} />
            </Label>
            <Input
              id="withdrawal-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </div>
          <Button disabled={busy} type="submit">
            {busy ? ui('Изпраща се...') : ui('Изпрати линк за потвърждение')}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          <CommerceText source={error} error />
        </p>
      )}
    </form>
  )
}
