'use client'

import { useForm, useFormFields } from '@payloadcms/ui'

type OrderItem = {
  product?: string | { id?: string | null; title?: string | null } | null
  productSKU?: string | null
  quantity?: number | null
}

type Props = {
  path?: string
}

const getProductLabel = (product: OrderItem['product']) => {
  if (!product) return '-'
  if (typeof product === 'string') return product

  return product.title || product.id || '-'
}

const normalizeItems = (value: unknown): OrderItem[] => {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is OrderItem => Boolean(item && typeof item === 'object'))
}

export function OrderItemsReadOnlyField({ path = 'items' }: Props) {
  const { getDataByPath } = useForm()

  useFormFields(([fields]) => fields[path])

  const items = normalizeItems(getDataByPath(path))

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0 }}>Артикули</h3>
        <p style={{ color: 'var(--theme-elevation-600)', margin: '0.25rem 0 0' }}>
          Артикулите са заключени, за да остане поръчката точен запис на заявката на клиента.
        </p>
      </div>

      {items.length > 0 ? (
        <div
          style={{
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--theme-elevation-50)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Продукт</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', width: '12rem' }}>Код</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', width: '8rem' }}>Количество</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} style={{ borderTop: '1px solid var(--theme-elevation-150)' }}>
                  <td style={{ padding: '0.75rem' }}>{getProductLabel(item.product)}</td>
                  <td style={{ padding: '0.75rem' }}>{item.productSKU || '-'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{item.quantity || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: 'var(--theme-elevation-600)' }}>Няма артикули.</p>
      )}
    </div>
  )
}
