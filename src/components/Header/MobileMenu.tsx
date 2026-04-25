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

      <SheetContent side="left" className="w-[86vw] max-w-[360px] px-5">
        <SheetHeader className="px-0 pt-4 pb-2">
          <SheetTitle className="text-xl font-normal text-[rgb(1,55,186)]">Меню</SheetTitle>

          <SheetDescription />
        </SheetHeader>

        <nav className="py-3" aria-label="Основна навигация">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-primary/45">
            Навигация
          </p>
          {menu?.length ? (
            <ul className="flex w-full flex-col divide-y divide-primary/8">
              {menu.map((item) => (
                <li key={item.id}>
                  <CMSLink
                    {...item.link}
                    appearance="link"
                    className="flex w-full justify-start rounded-none px-0 py-3 text-left text-[17px] font-normal text-primary/78 transition hover:text-[rgb(1,55,186)]"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </nav>

        {user ? (
          <section className="mt-5 rounded-2xl border border-[rgb(1,55,186)]/10 bg-[rgb(250,251,253)] px-4 py-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-primary/45">
              Моят профил
            </p>
            <ul className="flex flex-col divide-y divide-primary/8">
              <li>
                <Link
                  className="block py-3 text-[16px] font-normal text-primary/75 transition hover:text-[rgb(1,55,186)]"
                  href="/orders"
                >
                  Поръчки
                </Link>
              </li>
              <li>
                <Link
                  className="block py-3 text-[16px] font-normal text-primary/75 transition hover:text-[rgb(1,55,186)]"
                  href="/account/addresses"
                >
                  Адреси
                </Link>
              </li>
              <li>
                <Link
                  className="block py-3 text-[16px] font-normal text-primary/75 transition hover:text-[rgb(1,55,186)]"
                  href="/account"
                >
                  Настройки на профила
                </Link>
              </li>
              <li className="pt-4">
                <Button asChild className="w-full font-normal" variant="outline">
                  <Link href="/logout">Изход</Link>
                </Button>
              </li>
            </ul>
          </section>
        ) : (
          <section className="mt-5 rounded-2xl border border-[rgb(1,55,186)]/10 bg-[rgb(250,251,253)] px-4 py-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-primary/45">
              Моят профил
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full font-normal" variant="outline">
                <Link href="/login">Вход</Link>
              </Button>
              <span className="text-center text-xs uppercase tracking-[0.14em] text-primary/38">
                или
              </span>
              <Button asChild className="w-full bg-[rgb(1,55,186)] font-normal hover:bg-[rgb(0,46,158)]">
                <Link href="/create-account">Създай профил</Link>
              </Button>
            </div>
          </section>
        )}
      </SheetContent>
    </Sheet>
  )
}
