'use client'

import { Button } from '@/components/ui/button'
import type { Product } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import React, { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
type Props = {
  product: Product
}

export function AddToCart({ product }: Props) {
  const { addItem, cart, isLoading } = useCart()
  const normalizedProductID = String(product.id)

  const addToCart = useCallback(
    (e: React.FormEvent<HTMLButtonElement>) => {
      e.preventDefault()

      addItem({
        product: normalizedProductID,
      }).then(() => {
        toast.success('Продуктът е добавен в количката.')
      })
    },
    [addItem, normalizedProductID],
  )

  const disabled = useMemo<boolean>(() => {
    const existingItem = cart?.items?.find((item) => {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product

      return String(productID) === normalizedProductID
    })

    if (existingItem) {
      const existingQuantity = existingItem.quantity

      return existingQuantity >= (product.inventory || 0)
    }

    if (product.inventory === 0 || product.price <= 0 || !product.published) {
      return true
    }

    return false
  }, [cart?.items, normalizedProductID, product])

  return (
    <Button
      aria-label="Добави в количката"
      variant={'outline'}
      className={clsx('font-sans', {
        'h-12 rounded-md border-[rgb(1,55,186)] bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)] hover:text-white':
          !disabled,
        'hover:opacity-90': true,
        'h-12 rounded-md px-9 text-sm font-normal': true,
      })}
      disabled={disabled || isLoading}
      onClick={addToCart}
      type="submit"
    >
      Добави в количката
    </Button>
  )
}
