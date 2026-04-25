'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

const getStringValue = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : ''
}

type OrderResponse = {
  shippingAddress?: {
    firstName?: string | null
    lastName?: string | null
  } | null
}

export function OrderShippingNameField() {
  const { id } = useDocumentInfo()
  const formName = useFormFields(([fields]) => ({
    firstName: getStringValue(fields['shippingAddress.firstName']?.value),
    lastName: getStringValue(fields['shippingAddress.lastName']?.value),
  }))
  const [documentName, setDocumentName] = useState({ firstName: '', lastName: '' })

  useEffect(() => {
    if (!id) return

    let isCancelled = false

    const loadOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(String(id))}?depth=0`, {
          credentials: 'include',
        })

        if (!response.ok) return

        const order = (await response.json()) as OrderResponse

        if (isCancelled) return

        setDocumentName({
          firstName: getStringValue(order.shippingAddress?.firstName),
          lastName: getStringValue(order.shippingAddress?.lastName),
        })
      } catch {
        return
      }
    }

    void loadOrder()

    return () => {
      isCancelled = true
    }
  }, [id])

  const firstName = formName.firstName || documentName.firstName
  const lastName = formName.lastName || documentName.lastName
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  if (!fullName) return null

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label
        style={{
          color: 'var(--theme-elevation-800)',
          display: 'block',
          marginBottom: '0.5rem',
        }}
      >
        Име на клиент
      </label>
      <div
        style={{
          background: 'var(--theme-elevation-100)',
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: '4px',
          color: 'var(--theme-elevation-800)',
          padding: '0.75rem',
        }}
      >
        {fullName}
      </div>
    </div>
  )
}
