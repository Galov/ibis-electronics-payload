'use client'

import { useDocumentInfo, useFormModified } from '@payloadcms/ui'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

type CatalogSyncAdminStatus = {
  approved: boolean
  approvalStatus: 'approved' | 'error' | 'never_sent' | 'pending'
  commerceStatus: 'current' | 'error' | 'pending'
  contentStatus: 'changed' | 'current' | 'error' | 'pending'
  commerceLastError: null | string
  contentLastError: null | string
  lastError: null | string
  lastSuccessfulAt: null | string
  latest: null | {
    action: 'commerce' | 'content' | 'initial'
    attempts: number
    eventId: null | string
    status: string
  }
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
  commerce: {
    current: 'Търговските данни са актуални',
    error: 'Грешка при търговската синхронизация',
    pending: 'Търговската синхронизация чака',
  },
  content: {
    changed: 'Има неизпратени промени в съдържанието',
    current: 'Съдържанието е актуално',
    error: 'Грешка при изпращането на съдържанието',
    pending: 'Съдържанието чака обработка',
  },
} as const

const isPending = (status: CatalogSyncAdminStatus | null) =>
  status?.approvalStatus === 'pending' ||
  status?.contentStatus === 'pending' ||
  ['accepted', 'pending', 'retry_wait', 'sending'].includes(status?.latest?.status || '')

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

    void load()
    const interval = window.setInterval(() => {
      void load()
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
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
          <span>{statusLabels.content[status.contentStatus]}</span>
          {status.approved ? <span>{statusLabels.commerce[status.commerceStatus]}</span> : null}
          {status.latest ? (
            <small>
              Последна задача: {status.latest.status}, опити: {status.latest.attempts}
            </small>
          ) : null}
        </div>
      ) : null}
      {formModified ? <span>Първо запишете текущите промени в продукта.</span> : null}
      {status?.commerceLastError ? (
        <span style={{ color: 'var(--theme-error-500)' }}>
          Търговска синхронизация: {status.commerceLastError}
        </span>
      ) : null}
      {status?.contentLastError || error ? (
        <span style={{ color: 'var(--theme-error-500)' }}>{error || status?.contentLastError}</span>
      ) : null}
      {canSend ? (
        <button disabled={loading} onClick={send} style={buttonStyle} type="button">
          <span aria-hidden="true">🇷🇴</span>
          <span>{loading ? 'Добавя се в опашката…' : buttonLabel}</span>
        </button>
      ) : null}
    </div>
  )
}
