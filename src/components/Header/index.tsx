'use client'

import './index.css'

import { Cart } from '@/components/Cart'
import { SiteLogo } from '@/components/Logo/SiteLogo'
import { useAuth } from '@/providers/Auth'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { MobileMenu } from './MobileMenu'

const navItems = [
  {
    href: '/magazin',
    isActive: (pathname: string) =>
      pathname.startsWith('/magazin') ||
      pathname.startsWith('/shop') ||
      pathname.startsWith('/products'),
    label: 'Продукти',
  },
  {
    href: '/uslugi',
    isActive: (pathname: string) => pathname.startsWith('/uslugi'),
    label: 'Услуги',
  },
  {
    href: '/serviz',
    isActive: (pathname: string) => pathname.startsWith('/serviz'),
    label: 'Сервиз',
  },
  {
    href: '/za-nas',
    isActive: (pathname: string) => pathname.startsWith('/za-nas'),
    label: 'За нас',
  },
  {
    href: '/kontakti',
    isActive: (pathname: string) => pathname.startsWith('/kontakti') || pathname.startsWith('/contact'),
    label: 'Контакти',
  },
] as const

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

export function Header() {
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
      const activeItem = navItems.find((item) => item.isActive(pathname))
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
  }, [pathname])

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
        <div className="container hidden h-11 items-center justify-end md:flex">
          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  className={clsx(
                    'inline-flex h-9 items-center gap-2 rounded-[2px] px-3 text-sm text-white/82 transition-colors',
                    'hover:bg-white/8 hover:text-white',
                    profileOpen && 'bg-white/8 text-white',
                  )}
                  onClick={() => setProfileOpen((current) => !current)}
                  type="button"
                >
                  <span>Моят профил</span>
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
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center">
                <Link
                  className="rounded-[2px] px-3 py-2 text-sm text-white/82 transition-colors hover:bg-white/8 hover:text-white"
                  href="/login"
                >
                  Вход
                </Link>
                <span className="text-white/28">|</span>
                <Link
                  className="rounded-[2px] px-3 py-2 text-sm text-white/82 transition-colors hover:bg-white/8 hover:text-white"
                  href="/create-account"
                >
                  Регистрация
                </Link>
              </div>
            )}

            <div className="ml-5 border-l border-white/14 pl-5">
              <Cart />
            </div>
          </div>
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
        <nav className="container flex items-center justify-between py-6">
          <Link className="flex items-center" href="/magazin">
            <SiteLogo className="h-auto w-44" priority />
          </Link>

          <div className="headerNav relative flex items-center gap-8 text-sm" ref={navRef}>
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
                  'headerNavLink rounded-md px-3 py-2 text-base text-[rgb(1,55,186)]/88 transition-colors',
                  'hover:bg-[rgb(1,55,186)]/6 hover:text-[rgb(1,55,186)]',
                  item.isActive(pathname) && 'active',
                )}
                href={item.href}
                ref={(element) => {
                  itemRefs.current[item.href] = element
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}
