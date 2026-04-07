'use client'

import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo } from 'react'

type BrandItem = {
  id: string
  productCount?: number | null
  title: string
}

type Props = {
  brands: BrandItem[]
}

export const BrandList: React.FC<Props> = ({ brands }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeBrandID = useMemo(() => searchParams.get('brand'), [searchParams])

  const setBrand = useCallback(
    (brandID: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (activeBrandID === brandID) {
        params.delete('brand')
      } else {
        params.set('brand', brandID)
      }

      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [activeBrandID, pathname, router, searchParams],
  )

  return (
    <div>
      <h3 className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">Марки</h3>
      <ul className="space-y-1">
        {brands.map((brand) => {
          const isActive = activeBrandID === brand.id

          return (
            <li key={brand.id}>
              <button
                className={clsx('block text-left text-sm hover:cursor-pointer', {
                  'font-medium underline': isActive,
                  'text-primary/80': !isActive,
                })}
                onClick={() => setBrand(brand.id)}
                type="button"
              >
                {brand.title}
                {typeof brand.productCount === 'number' ? (
                  <span className="ml-2 text-xs text-muted-foreground">({brand.productCount})</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
