'use client'

import { useForm, useFormFields } from '@payloadcms/ui'

const getStringValue = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : ''
}

export function OrderShippingNameField() {
  const { getDataByPath } = useForm()

  useFormFields(([fields]) => ({
    firstName: fields['shippingAddress.firstName'],
    lastName: fields['shippingAddress.lastName'],
  }))

  const firstName = getStringValue(getDataByPath('shippingAddress.firstName'))
  const lastName = getStringValue(getDataByPath('shippingAddress.lastName'))
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
