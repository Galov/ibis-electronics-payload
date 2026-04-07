'use client'

import { useState } from 'react'

export function RecalculateRetailPricesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setIsLoading(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/pricing/recalculate', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Неуспешно преизчисляване.')
      }

      setMessage(
        `Готово. Надценка: ${data.markupPercent}%. Обработени: ${data.processed}. Обновени: ${data.updated}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Възникна грешка.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        style={{
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          background: '#0b76da',
          color: '#fff',
          border: 'none',
          fontWeight: 600,
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.8 : 1,
        }}
      >
        {isLoading ? 'Преизчисляване...' : 'Преизчисли всички цени'}
      </button>
      <p style={{ marginTop: '0.75rem', color: '#52606d', maxWidth: '42rem' }}>
        Използва текущата надценка и обновява всички продажни цени според базовата цена от Ibis Electronics.
      </p>
      {message ? <p style={{ marginTop: '0.5rem', color: '#137333' }}>{message}</p> : null}
      {error ? <p style={{ marginTop: '0.5rem', color: '#b42318' }}>{error}</p> : null}
    </div>
  )
}
