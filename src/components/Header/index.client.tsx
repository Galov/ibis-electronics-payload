'use client'
import { CMSLink } from '@/components/Link'
import { SiteLogo } from '@/components/Logo/SiteLogo'
import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import Link from 'next/link'
import React, { Suspense } from 'react'

import { MobileMenu } from './MobileMenu'

import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'

type HeaderNavItem = {
  id?: null | string
  link: Parameters<typeof CMSLink>[0]
}

type Props = {
  header: {
    navItems?: null | HeaderNavItem[]
  }
}

export function HeaderClient({ header }: Props) {
  const menu = header.navItems || []
  const pathname = usePathname()

  return (
    <div className="relative z-20 border-b border-[rgb(1,55,186)]/35 bg-[rgb(248,252,255)] shadow-[0_10px_24px_rgba(1,55,186,0.03)]">
      <nav className="container flex items-center justify-between py-4 md:py-6">
        <div className="block flex-none md:hidden">
          <Suspense fallback={null}>
            <MobileMenu menu={menu} />
          </Suspense>
        </div>
        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center gap-14 md:w-1/3">
            <Link className="flex w-full items-center justify-center py-6 md:w-auto" href="/">
              <SiteLogo className="h-auto w-44" priority />
            </Link>
            {menu.length ? (
              <ul className="hidden gap-4 pl-6 text-sm md:flex md:items-center">
                {menu.map((item) => (
                  <li key={item.id}>
                    <CMSLink
                      {...item.link}
                      size={'clear'}
                      className={cn('relative navLink rounded-[2px] px-3 py-2 text-xs uppercase tracking-[0.14em] text-primary/65 transition-colors hover:bg-[rgb(1,55,186)]/6 hover:text-primary', {
                        active:
                          item.link.url && item.link.url !== '/'
                            ? pathname.includes(item.link.url)
                            : false,
                      })}
                      appearance="nav"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex justify-end md:w-1/3 gap-4">
            <Suspense fallback={<OpenCartButton />}>
              <Cart />
            </Suspense>
          </div>
        </div>
      </nav>
    </div>
  )
}
