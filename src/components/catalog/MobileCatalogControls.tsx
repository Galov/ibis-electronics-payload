'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SlidersHorizontal } from 'lucide-react'
import React from 'react'

type Props = {
  children: React.ReactNode
}

export function MobileCatalogControls({ children }: Props) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="fixed right-4 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-[rgb(1,55,186)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_38px_rgba(1,55,186,0.28)] transition hover:bg-[rgb(0,46,158)]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Намери продукти
          </button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="max-h-[86vh] gap-0 overflow-y-auto rounded-t-3xl border-t border-[rgb(1,55,186)]/12 bg-white px-4 pb-6 pt-2"
        >
          <SheetHeader className="px-0 pb-4 pt-3 text-left">
            <SheetTitle className="text-xl font-normal text-primary/85">
              Филтриране и сортиране
            </SheetTitle>
            <SheetDescription className="text-sm text-primary/55">
              Търси, избери категория и подреди каталога.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
