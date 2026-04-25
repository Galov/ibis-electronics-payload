'use client'

import { useForm, useFormFields } from '@payloadcms/ui'
import { useEffect, useMemo, useState } from 'react'

type OrderItem = {
  product?: string | { id?: string | null; title?: string | null } | null
  productSKU?: string | null
  productUnitPrice?: number | null
  quantity?: number | null
}

type Props = {
  path?: string
}

const getProductLabel = (
  product: OrderItem['product'],
  productTitlesByID: Record<string, string>,
) => {
  if (!product) return '-'
  if (typeof product === 'string') return productTitlesByID[product] || product

  return product.title || product.id || '-'
}

const normalizeItems = (value: unknown): OrderItem[] => {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is OrderItem => Boolean(item && typeof item === 'object'))
}

const formatMoney = (value?: number | null) => {
  if (typeof value !== 'number') return '-'

  return new Intl.NumberFormat('bg-BG', {
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)
}

export function OrderItemsReadOnlyField({ path = 'items' }: Props) {
  const { getDataByPath } = useForm()

  useFormFields(([fields]) => fields[path])

  const items = normalizeItems(getDataByPath(path))
  const productIDs = useMemo(() => {
    const ids = new Set<string>()

    for (const item of items) {
      if (typeof item.product === 'string') {
        ids.add(item.product)
      }
    }

    return Array.from(ids)
  }, [items])
  const productIDKey = productIDs.join('\0')
  const [productTitlesByID, setProductTitlesByID] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!productIDKey) return

    let isCancelled = false

    const loadProductTitles = async () => {
      const ids = productIDKey.split('\0').filter(Boolean)
      const entries = await Promise.all(
        ids.map(async (productID): Promise<readonly [string, string] | null> => {
          try {
            const response = await fetch(
              `/api/products/${encodeURIComponent(productID)}?depth=0&select[title]=true`,
              { credentials: 'include' },
            )

            if (!response.ok) return null

            const product = (await response.json()) as { title?: string | null }

            return product.title ? [productID, product.title] : null
          } catch {
            return null
          }
        }),
      )

      const nextTitles = Object.fromEntries(
        entries.filter((entry): entry is readonly [string, string] => Boolean(entry)),
      )

      if (isCancelled || Object.keys(nextTitles).length === 0) return

      setProductTitlesByID((current) => ({
        ...current,
        ...nextTitles,
      }))
    }

    void loadProductTitles()

    return () => {
      isCancelled = true
    }
  }, [productIDKey])

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
                <th style={{ padding: '0.75rem', textAlign: 'right', width: '8rem' }}>Ед. цена</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', width: '8rem' }}>Общо</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const quantity = item.quantity || 0
                const lineTotal =
                  typeof item.productUnitPrice === 'number' ? item.productUnitPrice * quantity : null

                return (
                  <tr key={index} style={{ borderTop: '1px solid var(--theme-elevation-150)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      {getProductLabel(item.product, productTitlesByID)}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{item.productSKU || '-'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{quantity}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatMoney(item.productUnitPrice)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatMoney(lineTotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: 'var(--theme-elevation-600)' }}>Няма артикули.</p>
      )}
    </div>
  )
}
