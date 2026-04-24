import type { Product } from '@/payload-types'

import { GridAddToCartButton } from '@/components/Cart/GridAddToCartButton'
import { Price } from '@/components/Price'
import { getProductPrimaryImage } from '@/utilities/product'
import Link from 'next/link'
import React from 'react'
import clsx from 'clsx'
import Image from 'next/image'

type Props = {
  product: Partial<Product>
}

const hasCategoryTitle = (
  category: Product['categories'] extends infer T ? T extends Array<infer U> ? U : never : never,
): category is Extract<NonNullable<Product['categories']>[number], { title: string }> =>
  Boolean(category && typeof category !== 'string' && 'title' in category && category.title)

export const ProductGridItem: React.FC<Props> = ({ product }) => {
  const { price, title } = product
  const image = getProductPrimaryImage(product)
  const manufacturerCode = product.manufacturerCode || null
  const primaryCategory = product.categories?.find(hasCategoryTitle)?.title || null

  return (
    <article className="group flex h-full flex-col rounded-[10px] border border-transparent bg-white p-4 transition duration-300 ease-out hover:border-black/5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
      <div className="min-h-7">
        {manufacturerCode ? (
          <div className="inline-flex self-start bg-[rgb(1,55,186)]/14 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.04em] text-[rgb(1,55,186)]">
            {manufacturerCode}
          </div>
        ) : null}
      </div>

      <Link className="flex flex-1 flex-col" href={`/products/${product.slug}`}>
        <div className="relative mb-4 aspect-square overflow-hidden bg-white p-6">
          {image?.url ? (
            <Image
              alt={image.alt}
              className={clsx('object-contain transition duration-300 ease-in-out group-hover:scale-[1.02]')}
              fill
              sizes="(min-width: 1280px) 18rem, (min-width: 1024px) 16rem, (min-width: 640px) 14rem, 100vw"
              src={image.url}
            />
          ) : (
            <div className="h-full w-full bg-muted/40" />
          )}
        </div>

        <div className="flex flex-1 flex-col">
          <div className="type-product-card-title min-h-[2.5rem] text-black">{title}</div>

          <div className="mt-1 min-h-[3.75rem] space-y-0 text-sm leading-5 text-primary/35">
            {primaryCategory ? <p>{primaryCategory}</p> : null}
            {product.sku ? <p>Код: {product.sku}</p> : null}
          </div>
        </div>
      </Link>

      <div className="mt-2 flex items-center justify-between gap-4">
        {typeof price === 'number' && (
          <div className="font-semibold leading-none text-primary/75">
            <Price amount={price} />
          </div>
        )}

        {product.id ? (
          <GridAddToCartButton
            inventory={product.inventory}
            price={typeof price === 'number' ? price : null}
            productID={product.id}
            published={product.published}
            stockQty={product.stockQty}
          />
        ) : null}
      </div>
    </article>
  )
}
