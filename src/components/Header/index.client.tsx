'use client'

import './index.css'

import { Suspense } from 'react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Cart } from '@/components/Cart'
import { SiteLogo } from '@/components/Logo/SiteLogo'
import { useAuth } from '@/providers/Auth'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import Link from '@/i18n/Link'
import { stripLocale } from '@/i18n/config'
import { CommerceText } from '@/i18n/CommerceText'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { MobileMenu } from './MobileMenu'

export type HeaderNavItem = {
  href: string
  id: string
  label: string
}

const profileItems = [
  {
    href: '/orders',
    label: 'Поръчки',
  },
  {
    href: '/account/addresses',
    label: 'Адреси',
  },
  {
    href: '/account',
    label: 'Настройки',
  },
  {
    href: '/logout',
    label: 'Изход',
  },
] as const

const isNavItemActive = (href: string, pathname: string) => {
  pathname = pathname === '/en' || pathname === '/en/' ? '/magazin' : stripLocale(pathname)
  if (href === '/magazin') {
    return (
      pathname.startsWith('/magazin') ||
      pathname.startsWith('/shop') ||
      pathname.startsWith('/products')
    )
  }

  if (href === '/kontakti') {
    return pathname.startsWith('/kontakti') || pathname.startsWith('/contact')
  }

  if (href === '/') {
    return pathname === '/'
  }

  return pathname.startsWith(href)
}

export function HeaderClient({ navItems }: { navItems: HeaderNavItem[] }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isMobileCompact, setIsMobileCompact] = useState(false)
  const [indicatorStyle, setIndicatorStyle] = useState({ opacity: 0, width: 0, x: 0 })

  useEffect(() => {
    const updateIndicator = () => {
      const activeItem = navItems.find((item) => isNavItemActive(item.href, pathname))
      const navElement = navRef.current
      const activeElement = activeItem ? itemRefs.current[activeItem.href] : null

      if (!navElement || !activeElement) {
        setIndicatorStyle((current) => ({ ...current, opacity: 0 }))
        return
      }

      const navRect = navElement.getBoundingClientRect()
      const activeRect = activeElement.getBoundingClientRect()

      setIndicatorStyle({
        opacity: 1,
        width: activeRect.width,
        x: activeRect.left - navRect.left,
      })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)

    return () => {
      window.removeEventListener('resize', updateIndicator)
    }
  }, [navItems, pathname])

  useEffect(() => {
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      setIsMobileCompact(window.scrollY > 24)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(1,55,186)]/28 bg-[rgb(248,252,255)] shadow-[0_10px_24px_rgba(1,55,186,0.03)] md:relative md:z-20">
      <div className="relative z-30 border-b border-white/12 bg-[rgb(1,55,186)]">
        <div className="container flex h-11 items-center justify-end text-white">
          <Suspense fallback={null}>
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <div className="md:hidden">
              <LanguageSwitcher compact />
            </div>
          </Suspense>
        </div>
      </div>

      <div className="container md:hidden">
        <div
          className={clsx(
            'grid grid-cols-[auto_1fr_auto] items-center gap-4 transition-[height] duration-300 ease-out',
            isMobileCompact ? 'h-14' : 'h-20',
          )}
        >
          <MobileMenu
            menu={navItems.map((item) => ({
              id: item.href,
              link: {
                label: item.label,
                type: 'custom',
                url: item.href,
              },
            }))}
          />

          <div className="flex justify-center">
            <Link className="flex items-center" href="/magazin">
              <SiteLogo
                className={clsx(
                  'h-auto transition-[width] duration-300 ease-out',
                  isMobileCompact ? 'w-18' : 'w-36',
                )}
                priority
              />
            </Link>
          </div>

          <div className="flex justify-end">
            <Cart />
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <nav className="container flex flex-wrap items-center justify-between gap-x-5 gap-y-4 py-5">
          <Link className="flex items-center" href="/magazin">
            <SiteLogo className="h-auto w-36 xl:w-40" priority />
          </Link>

          <div
            className="headerNav relative order-3 flex w-full flex-wrap items-center justify-center gap-x-1 text-sm xl:order-2 xl:w-auto xl:flex-1"
            ref={navRef}
          >
            <span
              className="headerNavIndicator"
              style={{
                opacity: indicatorStyle.opacity,
                transform: `translateX(${indicatorStyle.x}px)`,
                width: `${indicatorStyle.width}px`,
              }}
            />
            {navItems.map((item) => (
              <Link
                key={item.href}
                className={clsx(
                  'headerNavLink rounded-md px-2 py-2 text-sm text-[rgb(1,55,186)]/88 transition-colors',
                  'hover:bg-[rgb(1,55,186)]/6 hover:text-[rgb(1,55,186)]',
                  isNavItemActive(item.href, pathname) && 'active',
                )}
                href={item.href}
                ref={(element) => {
                  itemRefs.current[item.href] = element
                }}
              >
                <CommerceText source={item.label} />
              </Link>
            ))}
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-1 xl:order-3">
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  className={clsx(
                    'inline-flex h-9 items-center gap-2 rounded-[2px] px-3 text-sm text-[rgb(1,55,186)] transition-colors',
                    'hover:bg-[rgb(1,55,186)]/6 hover:text-[rgb(1,55,186)]',
                    profileOpen && 'bg-[rgb(1,55,186)]/6 text-[rgb(1,55,186)]',
                  )}
                  onClick={() => setProfileOpen((current) => !current)}
                  type="button"
                >
                  <span>
                    <CommerceText source="Моят профил" />
                  </span>
                  <ChevronDown
                    className={clsx('h-3.5 w-3.5 transition-transform duration-200', {
                      'rotate-180': profileOpen,
                    })}
                  />
                </button>

                {profileOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.45rem)] z-40 min-w-52 overflow-hidden rounded-[10px] border border-black/8 bg-white py-2 shadow-[0_18px_42px_rgba(15,23,42,0.12)]">
                    {profileItems.map((item) => (
                      <Link
                        key={item.href}
                        className="block px-4 py-2.5 text-sm text-primary/72 transition hover:bg-black/[0.03] hover:text-primary"
                        href={item.href}
                      >
                        <CommerceText source={item.label} />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center">
                <Link
                  className="rounded-[2px] px-3 py-2 text-sm text-[rgb(1,55,186)] transition-colors hover:bg-[rgb(1,55,186)]/6 hover:text-[rgb(1,55,186)]"
                  href="/login"
                >
                  <CommerceText source="Вход" />
                </Link>
                <span className="text-[rgb(1,55,186)]/28">|</span>
                <Link
                  className="rounded-[2px] px-3 py-2 text-sm text-[rgb(1,55,186)] transition-colors hover:bg-[rgb(1,55,186)]/6 hover:text-[rgb(1,55,186)]"
                  href="/create-account"
                >
                  <CommerceText source="Регистрация" />
                </Link>
              </div>
            )}

            <div className="ml-2 border-l border-[rgb(1,55,186)]/14 pl-3">
              <Cart />
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
