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
      className="group relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-[rgb(1,55,186)]/12 bg-white font-sans text-sm font-medium no-underline text-[rgb(1,55,186)] transition-colors hover:bg-[rgb(1,55,186)]/6 hover:text-[rgb(1,55,186)] hover:no-underline md:h-auto md:w-auto md:gap-2 md:rounded-[2px] md:border-0 md:bg-transparent md:px-3 md:py-2 md:text-white/82 md:hover:bg-white/8 md:hover:text-white"
      {...rest}
    >
      <ShoppingCart className="size-5 transition-colors md:size-4 md:group-hover:text-white" />
      <span className="sr-only md:not-sr-only">Количка</span>

      {quantity ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[rgb(1,55,186)] px-1.5 py-0.5 text-[11px] font-medium leading-none text-white shadow-[0_4px_10px_rgba(1,55,186,0.22)] md:static md:bg-white md:text-[rgb(1,55,186)] md:shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
          {quantity}
        </span>
      ) : null}
    </Button>
  )
}
