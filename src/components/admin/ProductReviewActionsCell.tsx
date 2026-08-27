'use client'

import type { DefaultCellComponentProps } from 'payload'
import Link from 'next/link'
import { useState } from 'react'

type ReviewQueueRow = {
  product?: null | number | string | { id?: number | string }
  productSlug?: null | string
  status?: null | string
}

const getProductID = (product: ReviewQueueRow['product']) => {
  if (typeof product === 'string' || typeof product === 'number') return String(product)
  if (product && typeof product.id !== 'undefined') return String(product.id)
  return null
}

export const ProductReviewActionsCell = ({ rowData }: DefaultCellComponentProps) => {
  const row = rowData as ReviewQueueRow
  const productID = getProductID(row.product)
  const [isLoading, setIsLoading] = useState(false)
  const [isReviewed, setIsReviewed] = useState(row.status === 'reviewed')

  if (!productID) return null

  const markReviewed = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(
        `/api/maintenance/products/${encodeURIComponent(productID)}/reviewed`,
        {
          credentials: 'include',
          method: 'POST',
        },
      )

      if (!response.ok) throw new Error('Неуспешно маркиране като прегледан.')

      setIsReviewed(true)
      window.location.reload()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Неуспешно маркиране като прегледан.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <span style={{ alignItems: 'center', display: 'flex', gap: '0.75rem', whiteSpace: 'nowrap' }}>
      <Link href={`/admin/collections/products/${productID}`}>Админ</Link>
      {row.productSlug ? (
        <Link href={`/products/${row.productSlug}`} rel="noreferrer" target="_blank">
          Публично
        </Link>
      ) : null}
      {!isReviewed ? (
        <button
          disabled={isLoading}
          onClick={() => void markReviewed()}
          style={{
            background: 'transparent',
            border: 0,
            color: '#137333',
            cursor: isLoading ? 'wait' : 'pointer',
            font: 'inherit',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
          type="button"
        >
          {isLoading ? 'Маркиране...' : 'Маркирай като прегледан'}
        </button>
      ) : null}
    </span>
  )
}
