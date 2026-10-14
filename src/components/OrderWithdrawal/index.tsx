'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [confirming, setConfirming] = useState(Boolean(token && !orderID))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  if (requestedAt)
    return (
      <p role="status" className="text-sm leading-6">
        Отказът от поръчката е записан. Ибис Електроникс ще обработи случая.
      </p>
    )
  if (closed) return <p className="text-sm">Поръчката вече е отменена или сумата е възстановена.</p>

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
      if (!response.ok) throw new Error(result.error || 'Отказът не е записан.')
      setMessage(
        result.status === 'cancelled'
          ? 'Поръчката е отменена. Ако отказът е записан сега, ще получите потвърждение по имейл.'
          : 'Отказът е записан. Ще получите потвърждение по имейл, а Ибис Електроникс ще ви информира за следващите стъпки.',
      )
      setDone(true)
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Опитайте отново или се свържете с Ибис Електроникс.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-[10px] border border-black/10 bg-white p-5">
      <h2 className="type-section-title">Отказ от поръчка</h2>
      {done ? (
        <p role="status">{message}</p>
      ) : confirming ? (
        <>
          <p className="text-sm leading-6">
            Потвърдете, че искате да се откажете от цялата поръчка. Ако тя вече е обработена или
            изпратена, Ибис Електроникс ще уреди необходимите стъпки за връщане и, когато е приложимо,
            възстановяване на сумата.
          </p>
          <div className="text-sm leading-6 text-primary/70">
            <ReturnCostNotice />
          </div>
          <p className="text-sm leading-6">
            Потвърждението записва заявения отказ. То не потвърждава получаването на върнатите стоки
            или възстановяването на сумата.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Записва се...' : 'Потвърждавам отказа'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Назад
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-6">
            Можете да отмените поръчката преди обработка или да заявите отказ, ако тя вече е
            обработена. Законовият срок за отказ по общото правило е 14 дни от получаването на
            стоката, а не от поръчването. Ибис Електроникс ще провери случая и приложимите законови изключения.
          </p>
          <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
            Откажи поръчката
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </section>
  )
}

export function GuestWithdrawalForm() {
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
            body: JSON.stringify({ orderID: data.get('orderID'), email: data.get('email') }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Опитайте отново.')
          setSent(true)
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Опитайте отново.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm leading-6">
        Въведете номера на поръчката и имейла, използван при покупката. Ще получите линк за
        потвърждение. Самото изпращане на тази форма не отменя поръчката.
      </p>
      <div className="text-sm leading-6 text-primary/70">
        <ReturnCostNotice />
      </div>
      {sent ? (
        <p role="status">
          Ако данните съответстват на поръчка, изпратихме линк по имейл. Проверете и папката Спам.
          Линкът е валиден 24 часа. Ако съобщението не пристигне, свържете се с Ибис Електроникс; можете да
          заявите отказа и по имейл.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-order">Номер на поръчката</Label>
            <Input
              id="withdrawal-order"
              name="orderID"
              required
              maxLength={24}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-email">Имейлът, използван при поръчката</Label>
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
            {busy ? 'Изпраща се...' : 'Изпрати линк за потвърждение'}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </form>
  )
}
