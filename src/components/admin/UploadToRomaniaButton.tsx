'use client'

import { useDocumentInfo, useFormModified } from '@payloadcms/ui'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

type CatalogSyncAdminStatus = {
  approved: boolean
  approvalStatus: 'approved' | 'error' | 'never_sent' | 'pending'
  contentStatus: 'changed' | 'current' | 'error' | 'pending'
  lastAttemptedAt: null | string
  lastError: null | string
  lastErrorAt: null | string
  lastEventId: null | string
  lastRemoteStatus: null | string
  lastSuccessfulAt: null | string
  lastSuccessfulEventId: null | string
  message?: string
}

const wrapperStyle: CSSProperties = {
  background:
    'linear-gradient(135deg, rgba(0, 43, 127, 0.08), rgba(252, 209, 22, 0.12), rgba(206, 17, 38, 0.08))',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '10px',
  display: 'grid',
  gap: '0.8rem',
  marginBottom: '1rem',
  padding: '1rem',
}

const buttonStyle: CSSProperties = {
  alignItems: 'center',
  background: '#002b7f',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  cursor: 'pointer',
  display: 'inline-flex',
  fontWeight: 700,
  gap: '0.5rem',
  justifyContent: 'center',
  padding: '0.75rem 1rem',
  width: 'fit-content',
}

const statusLabels = {
  approval: {
    approved: 'Одобрен за румънския каталог',
    error: 'Грешка при първоначалното изпращане',
    never_sent: 'Никога не е изпращан',
    pending: 'Първоначалното изпращане чака',
  },
  content: {
    changed: 'Има неизпратени промени в съдържанието',
    current: 'Съдържанието е актуално',
    error: 'Грешка при изпращането на съдържанието',
    pending: 'Съдържанието чака обработка',
  },
} as const

const remoteStatusLabels: Record<string, string> = {
  accepted: 'Събитието е прието от румънския сайт',
  pending: 'Събитието чака обработка',
  processing: 'Продуктът се обработва',
  queued: 'Продуктът чака превод',
  sending: 'Продуктът се изпраща',
  succeeded: 'Преводът и записът са завършени успешно',
  superseded: 'По-нова версия на продукта вече е обработена',
  translating: 'Продуктът се превежда',
}

const isPending = (status: CatalogSyncAdminStatus | null) => status?.contentStatus === 'pending'

export function UploadToRomaniaButton() {
  const { id } = useDocumentInfo()
  const formModified = useFormModified()
  const productID = id ? String(id) : ''
  const [status, setStatus] = useState<CatalogSyncAdminStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!productID) return
    let cancelled = false
    let timeout: number | undefined

    const load = async () => {
      try {
        const response = await fetch(
          `/api/maintenance/products/${encodeURIComponent(productID)}/catalog-sync`,
        )
        const body = (await response.json()) as CatalogSyncAdminStatus & { message?: string }
        if (!response.ok) throw new Error(body.message || 'Статусът не може да бъде зареден.')
        if (!cancelled) {
          setStatus(body)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Неизвестна грешка.')
        }
      }
    }

    const poll = async () => {
      await load()
      if (!cancelled) timeout = window.setTimeout(poll, 5000)
    }

    void poll()
    return () => {
      cancelled = true
      if (timeout) window.clearTimeout(timeout)
    }
  }, [productID])

  const send = async () => {
    if (!productID || loading || formModified) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/maintenance/products/${encodeURIComponent(productID)}/catalog-sync`,
        { method: 'POST' },
      )
      const body = (await response.json()) as CatalogSyncAdminStatus & { message?: string }
      if (!response.ok) throw new Error(body.message || 'Продуктът не може да бъде изпратен.')
      setStatus(body)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Неизвестна грешка.')
    } finally {
      setLoading(false)
    }
  }

  const canSend =
    Boolean(productID) &&
    !formModified &&
    !loading &&
    !isPending(status) &&
    (!status?.approved || status.contentStatus === 'changed' || status.contentStatus === 'error')
  const buttonLabel = status?.approved
    ? 'Изпрати промените в съдържанието'
    : 'Изпрати към румънския сайт'

  return (
    <div style={wrapperStyle}>
      <strong>Румънски каталог</strong>
      {!productID ? <span>Запишете продукта, преди да го изпратите.</span> : null}
      {status ? (
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span>{statusLabels.approval[status.approvalStatus]}</span>
          {status.approved || status.approvalStatus !== 'never_sent' ? (
            <span>{statusLabels.content[status.contentStatus]}</span>
          ) : null}
          {status.lastRemoteStatus ? (
            <small>
              {remoteStatusLabels[status.lastRemoteStatus] ||
                `Статус от румънския сайт: ${status.lastRemoteStatus}`}
            </small>
          ) : null}
          {status.lastSuccessfulAt ? (
            <small>
              Последен успешен превод: {new Date(status.lastSuccessfulAt).toLocaleString('bg-BG')}
            </small>
          ) : null}
        </div>
      ) : null}
      {formModified ? <span>Първо запишете текущите промени в продукта.</span> : null}
      {status?.lastError || error ? (
        <span style={{ color: 'var(--theme-error-500)' }}>
          {error || status?.lastError}
          {!error && status?.lastErrorAt
            ? ` (${new Date(status.lastErrorAt).toLocaleString('bg-BG')})`
            : ''}
        </span>
      ) : null}
      {canSend ? (
        <button disabled={loading} onClick={send} style={buttonStyle} type="button">
          <span aria-hidden="true">🇷🇴</span>
          <span>{loading ? 'Изпраща се…' : buttonLabel}</span>
        </button>
      ) : null}
    </div>
  )
}
