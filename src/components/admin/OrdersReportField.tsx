'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'

type StatusSummary = {
  status: string
  orderCount: number
  amount: number
}

type OrdersSummary = {
  month: string
  orderCount: number
  turnover: number
  cancelledCount: number
  cancelledAmount: number
  averageOrderValue: number
  byStatus: StatusSummary[]
}

const getDefaultMonth = () => {
  const date = new Date()
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('bg-BG', {
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)

const statusLabels: Record<string, string> = {
  cancelled: 'Отказана',
  completed: 'Завършена',
  processing: 'Обработва се',
}

export function OrdersReportField() {
  const [month, setMonth] = useState(getDefaultMonth)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<OrdersSummary | null>(null)

  const summaryRows = useMemo(() => {
    if (!summary) return []

    return summary.byStatus.map((row) => ({
      ...row,
      label: statusLabels[row.status] || row.status,
    }))
  }, [summary])

  const loadSummary = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/reports/orders?month=${encodeURIComponent(month)}&format=json`, {
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Неуспешно зареждане на справката.')
      }

      setSummary(data.summary)
    } catch (err) {
      setSummary(null)
      setError(err instanceof Error ? err.message : 'Възникна грешка.')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadCsv = async () => {
    setIsDownloading(true)
    setError(null)

    try {
      const response = await fetch(`/api/reports/orders?month=${encodeURIComponent(month)}&format=csv`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || 'Неуспешен експорт.')
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `orders-report-${month}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Възникна грешка.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div style={{ marginTop: '0.75rem', maxWidth: '52rem' }}>
      <div
        style={{
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: '12px',
          padding: '1rem',
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: '0.375rem' }}>
            <span style={{ color: '#344054', fontSize: '0.875rem', fontWeight: 600 }}>Месец</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={{
                border: '1px solid #d0d5dd',
                borderRadius: '8px',
                padding: '0.625rem 0.75rem',
                minWidth: '12rem',
              }}
            />
          </label>

          <button
            type="button"
            onClick={loadSummary}
            disabled={isLoading || !month}
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
            {isLoading ? 'Зареждане...' : 'Покажи справка'}
          </button>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={isDownloading || !month}
            style={{
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #d0d5dd',
              fontWeight: 600,
              cursor: isDownloading ? 'wait' : 'pointer',
              opacity: isDownloading ? 0.8 : 1,
            }}
          >
            {isDownloading ? 'Експорт...' : 'Експорт CSV'}
          </button>
        </div>

        <p style={{ marginTop: '0.75rem', color: '#52606d', lineHeight: 1.6 }}>
          Справката смята оборота по поръчки със статуси <strong>processing</strong> и <strong>completed</strong>.
          Отказаните поръчки се показват отделно, за да не влизат в сумата.
        </p>

        {error ? <p style={{ marginTop: '0.75rem', color: '#b42318' }}>{error}</p> : null}

        {summary ? (
          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
            <div
              style={{
                display: 'grid',
                gap: '0.75rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              <MetricCard label="Оборот" value={formatMoney(summary.turnover)} />
              <MetricCard label="Поръчки" value={String(summary.orderCount)} />
              <MetricCard label="Средна поръчка" value={formatMoney(summary.averageOrderValue)} />
              <MetricCard label="Отказани" value={`${summary.cancelledCount} / ${formatMoney(summary.cancelledAmount)}`} />
            </div>

            <div style={{ border: '1px solid #eaecf0', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={tableHeaderStyle}>Статус</th>
                    <th style={tableHeaderStyle}>Поръчки</th>
                    <th style={tableHeaderStyle}>Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.status}>
                      <td style={tableCellStyle}>{row.label}</td>
                      <td style={tableCellStyle}>{row.orderCount}</td>
                      <td style={tableCellStyle}>{formatMoney(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #eaecf0',
        borderRadius: '10px',
        padding: '0.875rem 1rem',
      }}
    >
      <div style={{ color: '#475467', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ color: '#101828', fontSize: '1rem', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const tableHeaderStyle: CSSProperties = {
  borderBottom: '1px solid #eaecf0',
  color: '#475467',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  padding: '0.75rem 1rem',
  textAlign: 'left',
  textTransform: 'uppercase',
}

const tableCellStyle: CSSProperties = {
  borderBottom: '1px solid #eaecf0',
  color: '#101828',
  padding: '0.75rem 1rem',
}
