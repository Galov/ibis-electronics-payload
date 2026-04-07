'use client'

import { CMSLink } from '@/components/Link'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/providers/Auth'
import { MenuIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'

interface Props {
  menu?: null | Array<{ id?: null | string; link: Parameters<typeof CMSLink>[0] }>
}

export function MobileMenu({ menu }: Props) {
  const { user } = useAuth()

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname, searchParams])

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger className="relative flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 text-black transition-colors dark:border-neutral-700 dark:bg-black dark:text-white">
        <MenuIcon className="h-4" />
      </SheetTrigger>

      <SheetContent side="left" className="px-4">
        <SheetHeader className="px-0 pt-4 pb-0">
          <SheetTitle>Меню</SheetTitle>

          <SheetDescription />
        </SheetHeader>

        <div className="py-4">
          {menu?.length ? (
            <ul className="flex w-full flex-col">
              {menu.map((item) => (
                <li className="py-2" key={item.id}>
                  <CMSLink {...item.link} appearance="link" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {user ? (
          <div className="mt-4">
            <h2 className="text-xl mb-4">Моят профил</h2>
            <hr className="my-2" />
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/orders">Поръчки</Link>
              </li>
              <li>
                <Link href="/account/addresses">Адреси</Link>
              </li>
              <li>
                <Link href="/account">Настройки на профила</Link>
              </li>
              <li className="mt-6">
                <Button asChild variant="outline">
                  <Link href="/logout">Изход</Link>
                </Button>
              </li>
            </ul>
          </div>
        ) : (
          <div>
            <h2 className="text-xl mb-4">Моят профил</h2>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild className="w-full sm:flex-1" variant="outline">
                <Link href="/login">Вход</Link>
              </Button>
              <span className="text-center text-sm text-muted-foreground sm:text-base">или</span>
              <Button asChild className="w-full sm:flex-1">
                <Link href="/create-account">Създай профил</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
