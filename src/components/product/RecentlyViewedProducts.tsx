'use client'

import type { Product } from '@/payload-types'

import { ProductGridItem } from '@/components/ProductGridItem'
import React, { useEffect, useMemo, useState } from 'react'

const RECENTLY_VIEWED_PRODUCTS_KEY = 'nik-electric-recently-viewed-products-v2'
const MAX_RECENTLY_VIEWED_PRODUCTS = 6

type RecentlyViewedProduct = Pick<
  Product,
  | 'categories'
  | 'id'
  | 'images'
  | 'inventory'
  | 'manufacturerCode'
  | 'price'
  | 'published'
  | 'slug'
  | 'sku'
  | 'stockQty'
  | 'title'
>

const isRecentlyViewedProduct = (value: unknown): value is RecentlyViewedProduct => {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<RecentlyViewedProduct>

  return Boolean(candidate.id && candidate.slug && candidate.title)
}

const readRecentlyViewedProducts = () => {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(RECENTLY_VIEWED_PRODUCTS_KEY)

    if (!storedValue) return []

    const parsedValue = JSON.parse(storedValue)

    if (!Array.isArray(parsedValue)) return []

    return parsedValue.filter(isRecentlyViewedProduct)
  } catch {
    return []
  }
}

type Props = {
  product: RecentlyViewedProduct
}

export const RecentlyViewedProducts: React.FC<Props> = ({ product }) => {
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<RecentlyViewedProduct[]>([])

  useEffect(() => {
    const storedProducts = readRecentlyViewedProducts()
    const filteredProducts = storedProducts.filter((item) => item.id !== product.id)
    const nextProducts = [product, ...filteredProducts].slice(0, MAX_RECENTLY_VIEWED_PRODUCTS)

    window.localStorage.setItem(RECENTLY_VIEWED_PRODUCTS_KEY, JSON.stringify(nextProducts))
    setRecentlyViewedProducts(filteredProducts.slice(0, MAX_RECENTLY_VIEWED_PRODUCTS - 1))
  }, [product])

  const productsToRender = useMemo(
    () => recentlyViewedProducts.filter((item) => item.published !== false && item.slug),
    [recentlyViewedProducts],
  )

  if (productsToRender.length === 0) return null

  return (
    <section className="mt-12 border-t pt-10">
      <div className="mb-6">
        <h2 className="text-lg font-normal text-primary/85 lg:text-xl">Вие последно разгледахте</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {productsToRender.map((recentlyViewedProduct) => (
          <ProductGridItem key={recentlyViewedProduct.id} product={recentlyViewedProduct} />
        ))}
      </div>
    </section>
  )
}
