'use client'

import { CartItem } from '@/components/Cart'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import { MinusIcon, PlusIcon } from 'lucide-react'
import React, { useMemo } from 'react'

export function EditItemQuantityButton({ type, item }: { item: CartItem; type: 'minus' | 'plus' }) {
  const { decrementItem, incrementItem, isLoading } = useCart()

  const disabled = useMemo(() => {
    if (!item.id) return true

    const target =
      item.product && typeof item.product === 'object' ? item.product : null

    if (
      target &&
      typeof target === 'object' &&
      target.inventory !== undefined &&
      target.inventory !== null
    ) {
      if (type === 'plus' && item.quantity !== undefined && item.quantity !== null) {
        return item.quantity >= target.inventory
      }
    }

    return false
  }, [item, type])

  return (
    <form>
      <button
        disabled={disabled || isLoading}
        aria-label={type === 'plus' ? 'Increase item quantity' : 'Reduce item quantity'}
        className={clsx(
          'flex h-full min-w-[36px] max-w-[36px] flex-none items-center justify-center px-2 transition-all duration-200 ease-out hover:cursor-pointer hover:bg-[rgb(1,55,186)]/6',
          {
            'cursor-not-allowed': disabled || isLoading,
            'ml-auto': type === 'minus',
          },
        )}
        onClick={(e: React.FormEvent<HTMLButtonElement>) => {
          e.preventDefault()

          if (item.id) {
            if (type === 'plus') {
              incrementItem(item.id)
            } else {
              decrementItem(item.id)
            }
          }
        }}
        type="button"
      >
        {type === 'plus' ? (
          <PlusIcon className="h-4 w-4 text-primary/55 transition hover:text-[rgb(1,55,186)]" />
        ) : (
          <MinusIcon className="h-4 w-4 text-primary/55 transition hover:text-[rgb(1,55,186)]" />
        )}
      </button>
    </form>
  )
}
