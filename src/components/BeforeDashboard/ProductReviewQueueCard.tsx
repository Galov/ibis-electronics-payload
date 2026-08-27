'use client'

import Link from 'next/link'
import { useState } from 'react'

const baseClass = 'before-dashboard'
const unreviewedProductsAdminHref =
  '/admin/collections/products?' +
  [
    ['sort', '-createdAt'],
    ['where[needsReview][equals]', 'true'],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

type ProductReviewQueueItem = {
  createdAt?: null | string
  id: string
  productCreatedSource?: null | string
  reviewRequiredAt?: null | string
  sku?: null | string
  slug?: null | string
  title?: null | string
}

type ProductReviewQueueCardProps = {
  products: ProductReviewQueueItem[]
  totalDocs: number
  visibleProductsLimit: number
}

const formatDate = (value?: null | string) => {
  if (!value) return '-'

  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

const getSourceLabel = (source?: null | string) => {
  if (source === 'nik') return 'НИК'
  if (source === 'other') return 'Друг източник'
  return 'Ръчно'
}

export const ProductReviewQueueCard = ({
  products,
  totalDocs,
  visibleProductsLimit,
}: ProductReviewQueueCardProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [visibleProducts, setVisibleProducts] = useState(products)
  const [total, setTotal] = useState(totalDocs)
  const [loadingProductID, setLoadingProductID] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMarkReviewed = async (productID: string) => {
    setLoadingProductID(productID)
    setError(null)

    try {
      const response = await fetch(`/api/maintenance/products/${encodeURIComponent(productID)}/reviewed`, {
        credentials: 'include',
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        throw new Error(data?.message || 'Неуспешно маркиране като прегледан.')
      }

      setVisibleProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productID),
      )
      setTotal((currentTotal) => Math.max(0, currentTotal - 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Възникна грешка при маркирането.')
    } finally {
      setLoadingProductID(null)
    }
  }

  return (
    <section className={baseClass}>
      <div className={`${baseClass}__card`}>
        <div className={`${baseClass}__header`}>
          <div>
            <p className={`${baseClass}__eyebrow`}>Product review queue</p>
            <h2>Нови продукти за преглед</h2>
          </div>
          <div className={`${baseClass}__headerActions`}>
            <strong className={`${baseClass}__count`}>{total}</strong>
            {total > 0 ? (
              <button
                aria-expanded={isOpen}
                className={`${baseClass}__toggle`}
                onClick={() => setIsOpen((currentValue) => !currentValue)}
                type="button"
              >
                {isOpen ? 'Скрий' : 'Покажи'}
              </button>
            ) : null}
          </div>
        </div>

        {total > 0 ? (
          <>
            <p className={`${baseClass}__description`}>
              Има {total} продукта за преглед. Списъкът показва до {visibleProductsLimit} продукта
              наведнъж.
            </p>
            {error ? <p className={`${baseClass}__error`}>{error}</p> : null}

            {isOpen ? (
              <>
                <div className={`${baseClass}__list`}>
                  {visibleProducts.map((product) => (
                    <div className={`${baseClass}__item`} key={product.id}>
                      <div>
                        <Link href={`/admin/collections/products/${product.id}`}>
                          {product.title || product.sku || product.id}
                        </Link>
                        <p>
                          {product.sku ? `SKU: ${product.sku}` : 'Без SKU'} · Източник:{' '}
                          {getSourceLabel(product.productCreatedSource)} · За преглед от:{' '}
                          {formatDate(product.reviewRequiredAt)}
                        </p>
                      </div>
                      <div className={`${baseClass}__actions`}>
                        <Link href={`/admin/collections/products/${product.id}`}>Админ</Link>
                        {product.slug ? (
                          <Link href={`/products/${product.slug}`} rel="noreferrer" target="_blank">
                            Публично
                          </Link>
                        ) : null}
                        <button
                          className={`${baseClass}__reviewButton`}
                          disabled={loadingProductID === product.id}
                          onClick={() => void handleMarkReviewed(product.id)}
                          type="button"
                        >
                          {loadingProductID === product.id ? 'Маркиране...' : 'Маркирай като прегледан'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {total > visibleProductsLimit ? (
                  <Link className={`${baseClass}__allLink`} href={unreviewedProductsAdminHref}>
                    Виж всички непрегледани продукти
                  </Link>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <p className={`${baseClass}__description`}>Няма нови непрегледани продукти.</p>
        )}
      </div>
    </section>
  )
}
