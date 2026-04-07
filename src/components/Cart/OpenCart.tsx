import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'
import React from 'react'

export function OpenCartButton({
  quantity,
  ...rest
}: {
  quantity?: number
}) {
  return (
    <Button
      variant="link"
      size="clear"
      className="group relative inline-flex items-center gap-2 rounded-[2px] px-3 py-2 font-sans text-sm font-medium no-underline text-white/82 transition-colors hover:bg-white/8 hover:text-white hover:no-underline"
      {...rest}
    >
      <ShoppingCart className="size-4 transition-colors group-hover:text-white" />
      <span>Количка</span>

      {quantity ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium leading-none text-[rgb(1,55,186)] shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
          {quantity}
        </span>
      ) : null}
    </Button>
  )
}
