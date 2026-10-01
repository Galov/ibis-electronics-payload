'use client'

import { useEffect, useState } from 'react'
import { useDocumentInfo, useFormModified } from '@payloadcms/ui'

const labels: Record<string, string> = {
  never_sent: 'Не е изпращана',
  queued: 'Чака превод',
  translating: 'Превежда се',
  succeeded: 'РО черновата е готова за преглед',
  superseded: 'Има по-нова изпратена версия',
  failed: 'Преводът е неуспешен',
  unknown: 'Резултатът не е потвърден',
}
export function ArticleSyncActions() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    status: string
    error?: string | null
    warnings?: string[]
  } | null>(null)
  const [error, setError] = useState('')
  const request = async (send: boolean) => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/article-sync/posts/${encodeURIComponent(String(id))}/${send ? 'send' : 'status'}`,
        { method: send ? 'POST' : 'GET', credentials: 'same-origin' },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Заявката не завърши.')
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Заявката не завърши.')
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    setResult(null)
    setError('')
  }, [id])
  if (!id) return <p>Запазете и публикувайте БГ статията преди изпращане.</p>
  return (
    <section>
      <h3>Превод към румънския блог</h3>
      <p>
        Изпраща се последната публикувана БГ версия. В РО се записва чернова за човешки преглед, без
        автоматично публикуване.
      </p>
      {modified && <p>Има незапазени промени. Първо ги запазете и публикувайте.</p>}
      <button type="button" disabled={busy || modified} onClick={() => request(true)}>
        Изпрати за превод към РО / повтори
      </button>{' '}
      <button type="button" disabled={busy} onClick={() => request(false)}>
        Провери статуса
      </button>
      {busy && <p>Изчакване…</p>}
      {result && <p>{labels[result.status] || result.status}</p>}
      {(error || result?.error) && <p role="alert">{error || result?.error}</p>}
      {Boolean(result?.warnings?.length) && (
        <ul>
          {result?.warnings?.map((w: string, i: number) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
