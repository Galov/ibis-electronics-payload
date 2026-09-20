'use client'

import { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

export function NikOrderActions() {
  const { id } = useDocumentInfo()
  const state = useFormFields(([fields]) => ({
    status: fields['nikOrder.status']?.value,
    attempt: fields['nikOrder.attemptId']?.value,
  }))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!id || !state.status || state.status === 'accepted') return null
  return (
    <div>
      <p>
        При недостиг уточнете с клиента изпълнението. Това действие повтаря само запазените SKU и
        количества; не анулира поръчката и не възстановява плащане.
      </p>
      <label>
        Основание за повторния опит
        <textarea
          value={reason}
          maxLength={2000}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !reason.trim()}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            const response = await fetch(
              `/api/nik-orders/${encodeURIComponent(String(id))}/retry`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, expectedAttemptId: state.attempt || null }),
              },
            )
            if (!response.ok) throw new Error((await response.json()).error)
            window.location.reload()
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Неуспешен опит.')
            setBusy(false)
          }
        }}
      >
        Повтори същата заявка към НИК
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
