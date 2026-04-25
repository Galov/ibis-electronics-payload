'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

const getStringValue = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : ''
}

export function OrderShippingNameField() {
  const { data } = useDocumentInfo()
  const formName = useFormFields(([fields]) => ({
    firstName: getStringValue(fields['shippingAddress.firstName']?.value),
    lastName: getStringValue(fields['shippingAddress.lastName']?.value),
  }))
  const shippingAddress =
    data && typeof data.shippingAddress === 'object' && data.shippingAddress !== null
      ? (data.shippingAddress as Record<string, unknown>)
      : null

  const firstName = formName.firstName || getStringValue(shippingAddress?.firstName)
  const lastName = formName.lastName || getStringValue(shippingAddress?.lastName)
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
