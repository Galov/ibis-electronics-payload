'use client'

import type { CartItem } from '@/components/Cart'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import { XIcon } from 'lucide-react'
import React from 'react'

export function DeleteItemButton({ item }: { item: CartItem }) {
  const { isLoading, removeItem } = useCart()
  const itemId = item.id

  return (
    <form>
      <button
        aria-label="Премахни продукт от количката"
        className={clsx(
          'flex h-5 w-5 items-center justify-center rounded-full bg-black/45 transition-all duration-200 ease-out hover:cursor-pointer hover:bg-black/60',
          {
            'cursor-not-allowed px-0': !itemId || isLoading,
          },
        )}
        disabled={!itemId || isLoading}
        onClick={(e: React.FormEvent<HTMLButtonElement>) => {
          e.preventDefault()
          if (itemId) removeItem(itemId)
        }}
        type="button"
      >
        <XIcon className="mx-px h-3.5 w-3.5 text-white" />
      </button>
    </form>
  )
}
