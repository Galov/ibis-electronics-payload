'use client'
import type { Product } from '@/payload-types'

import { AddToCart } from '@/components/Cart/AddToCart'
import { Price } from '@/components/Price'
import Link from 'next/link'
import React, { Suspense } from 'react'
import { StockIndicator } from '@/components/product/StockIndicator'
import { formatLegacyProductDescription } from '@/utilities/formatLegacyProductDescription'
import { buildCategoryPath } from '@/utilities/category'

type ProductCategoryLink = {
  parent?: null | ProductCategoryLink
  slug?: null | string
  title: string
}

export function ProductDescription({ product }: { product: Product }) {
  const description = formatLegacyProductDescription(product.description || product.shortDescription)
  const categories = (product.categories || []).reduce<ProductCategoryLink[]>((acc, category) => {
    if (!category || typeof category === 'string' || !category.title) return acc

    acc.push(category as ProductCategoryLink)

    return acc
  }, [])
  const brand = product.brand && typeof product.brand !== 'string' ? product.brand.title : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <h1 className="type-product-title text-primary/85">{product.title}</h1>
        <div className="text-base font-normal text-[rgb(1,55,186)] lg:text-lg">
          <Price amount={product.price} />
        </div>
      </div>
      <div className="grid gap-1.5 text-sm leading-6">
        {brand ? (
          <p>
            <span className="text-muted-foreground/70">Марка:</span>{' '}
            <span className="font-normal text-primary/80">{brand}</span>
          </p>
        ) : null}
        {product.sku ? (
          <p>
            <span className="text-muted-foreground/70">Код:</span>{' '}
            <span className="font-normal text-primary/80">{product.sku}</span>
          </p>
        ) : null}
        {categories.length > 0 ? (
          <p>
            <span className="text-muted-foreground/70">Категория:</span>{' '}
            <span className="font-normal text-primary/80">
              {categories.map((category, index) => (
                <React.Fragment key={`${category.slug || category.title}-${index}`}>
                  {index > 0 ? ', ' : null}
                  {category.slug ? (
                    <Link
                      className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]"
                      href={buildCategoryPath(category)}
                    >
                      {category.title}
                    </Link>
                  ) : (
                    category.title
                  )}
                </React.Fragment>
              ))}
            </span>
          </p>
        ) : null}
        {product.originalSku ? (
          <p>
            <span className="text-muted-foreground/70">Оригинален код:</span>{' '}
            <span className="font-normal text-primary/80">{product.originalSku}</span>
          </p>
        ) : null}
        {product.manufacturerCode ? (
          <p>
            <span className="text-muted-foreground/70">Производител:</span>{' '}
            <span className="font-normal text-primary/80">{product.manufacturerCode}</span>
          </p>
        ) : null}
      </div>
      {description ? <div className="type-body-small whitespace-pre-line text-primary/65">{description}</div> : null}
      <div className="space-y-4 border-t border-black/5 pt-5">
        <Suspense fallback={null}>
          <StockIndicator product={product} />
        </Suspense>

        <div className="flex items-center justify-between">
          <Suspense fallback={null}>
            <AddToCart product={product} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
