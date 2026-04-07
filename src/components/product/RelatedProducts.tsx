import type { Product } from '@/payload-types'

import { ProductGridItem } from '@/components/ProductGridItem'
import React from 'react'

type RelatedProduct = Pick<
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

type Props = {
  products: RelatedProduct[]
}

export const RelatedProducts: React.FC<Props> = ({ products }) => {
  if (products.length === 0) return null

  return (
    <section className="mt-12 border-t pt-10">
      <div className="mb-6">
        <h2 className="text-lg font-normal text-primary/85 lg:text-xl">Свързани продукти</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {products.map((product) => (
          <ProductGridItem key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
