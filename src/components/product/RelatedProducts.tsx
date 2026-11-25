import type { Locale } from '@/i18n/config'
import { Text } from '@/i18n/Text'
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
  locale?: Locale
}

export const RelatedProducts: React.FC<Props> = ({ products, locale = 'bg' }) => {
  if (products.length === 0) return null

  return (
    <section className="mt-12 border-t pt-10">
      <div className="mb-6">
        <h2 className="text-lg font-normal text-primary/85 lg:text-xl">
          <Text id="related" />
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {products.map((product) => (
          <ProductGridItem key={product.id} product={product} locale={locale} />
        ))}
      </div>
    </section>
  )
}
