'use client'

import { useDocumentInfo, useForm, useFormFields } from '@payloadcms/ui'
import { useState } from 'react'
import type { CSSProperties } from 'react'

type BoxNowParcelFormValue = {
  boxNowParcelId?: string | null
  compartmentSize?: number | null
  description?: string | null
  id?: string | null
  weight?: number | null
}

const panelStyle: CSSProperties = {
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '8px',
  marginTop: '1rem',
  padding: '1rem',
}

export function BoxNowShipmentField() {
  const { id } = useDocumentInfo()
  const { getDataByPath } = useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formState = useFormFields(([fields]) => ({
    deliveryMethod: fields.deliveryMethod?.value,
    lockerName: fields.boxNowLockerName?.value,
    orderID: fields.id?.value,
    shipmentError: fields.boxNowShipmentError?.value,
    shipmentStatus: fields.boxNowShipmentStatus?.value,
  }))

  const orderID = String(formState.orderID || id || '').trim()
  useFormFields(([fields]) => fields.boxNowParcels)

  const parcels = ((): BoxNowParcelFormValue[] => {
    const value = getDataByPath('boxNowParcels')
    return Array.isArray(value) ? (value as BoxNowParcelFormValue[]) : []
  })()
  const parcelIDs = parcels
    .map((parcel) => (typeof parcel?.boxNowParcelId === 'string' ? parcel.boxNowParcelId.trim() : ''))
    .filter(Boolean)

  if (formState.deliveryMethod !== 'boxnow') {
    return null
  }

  const handleCreateShipment = async () => {
    if (!orderID) {
      setError('Поръчката още няма ID. Запази я и опитай пак.')
      return
    }

    setIsLoading(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/boxnow/orders/${encodeURIComponent(orderID)}/shipment`, {
        body: JSON.stringify({ parcels }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      const data = (await response.json().catch(() => null)) as
        | { deliveryRequestId?: string; message?: string; parcelIds?: string[] }
        | null

      if (!response.ok) {
        throw new Error(data?.message || 'BoxNow shipment не беше създаден.')
      }

      setMessage(
        `Създадена е BoxNow пратка${data?.deliveryRequestId ? ` #${data.deliveryRequestId}` : ''}.`,
      )

      window.setTimeout(() => {
        window.location.reload()
      }, 600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Възникна грешка при създаването на BoxNow shipment.')
    } finally {
      setIsLoading(false)
    }
  }

  const shipmentAlreadyCreated = formState.shipmentStatus === 'created' || parcelIDs.length > 0

  return (
    <div style={panelStyle}>
      <label
        style={{
          color: 'var(--theme-elevation-900)',
          display: 'block',
          fontWeight: 600,
          marginBottom: '0.5rem',
        }}
      >
        BoxNow shipment
      </label>
      <p style={{ color: 'var(--theme-elevation-700)', margin: 0 }}>
        Избраният автомат е {typeof formState.lockerName === 'string' && formState.lockerName.trim() ? formState.lockerName : 'без име'}.
      </p>
      <p style={{ color: 'var(--theme-elevation-700)', margin: '0.5rem 0 0' }}>
        Попълни колетите по-долу и създай пратката ръчно, след като я подготвите в склада.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={handleCreateShipment}
          disabled={isLoading || shipmentAlreadyCreated}
          style={{
            background: shipmentAlreadyCreated ? 'var(--theme-elevation-200)' : '#0b76da',
            border: 'none',
            borderRadius: '8px',
            color: shipmentAlreadyCreated ? 'var(--theme-elevation-700)' : '#fff',
            cursor: isLoading || shipmentAlreadyCreated ? 'default' : 'pointer',
            fontWeight: 600,
            opacity: isLoading ? 0.8 : 1,
            padding: '0.75rem 1rem',
          }}
        >
          {shipmentAlreadyCreated ? 'Shipment е създаден' : isLoading ? 'Създаване...' : 'Create BoxNow Shipment'}
        </button>
      </div>
      {message ? <p style={{ color: '#137333', marginTop: '0.75rem' }}>{message}</p> : null}
      {error ? <p style={{ color: '#b42318', marginTop: '0.75rem' }}>{error}</p> : null}
      {!error && typeof formState.shipmentError === 'string' && formState.shipmentError.trim() ? (
        <p style={{ color: '#b42318', marginTop: '0.75rem' }}>{formState.shipmentError.trim()}</p>
      ) : null}
      {parcelIDs.length > 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ color: 'var(--theme-elevation-800)', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Етикети
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {parcelIDs.map((parcelID, index) => (
              <a
                key={parcelID}
                href={`/api/integrations/boxnow/orders/${encodeURIComponent(orderID)}/parcels/${encodeURIComponent(parcelID)}/label.pdf`}
                rel="noreferrer"
                style={{ color: '#0b76da', textDecoration: 'underline' }}
                target="_blank"
              >
                Етикет за колет {index + 1} ({parcelID})
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
