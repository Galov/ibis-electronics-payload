import { CMSLink } from '@/components/Link'
import { SiteLogo } from '@/components/Logo/SiteLogo'
import { getCachedGlobal } from '@/utilities/getGlobals'
import type { ContactPage, Footer as FooterGlobal } from '@/payload-types'
import { Clock3, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const { SITE_NAME = 'Ibis Electronics' } = process.env

const formatWorkingHours = (value?: string | null) => value?.replace(/:\s*/, ':\n')

const locationRows = (location?: ContactPage['store'] | null) =>
  [
    {
      icon: MapPin,
      label: 'Адрес',
      value: location?.address,
    },
    {
      icon: Phone,
      label: 'Телефон',
      value: location?.phone,
      href: location?.phone ? `tel:${location.phone.replace(/\s+/g, '')}` : undefined,
    },
    {
      icon: Clock3,
      label: 'Работно време',
      value: formatWorkingHours(location?.workingHours),
    },
  ].filter((row): row is typeof row & { value: string } => Boolean(row.value))

export async function Footer() {
  const footer = (await getCachedGlobal('footer', 1)()) as FooterGlobal
  const contactPage = (await getCachedGlobal('contact-page', 0)()) as ContactPage

  const locations = [
    {
      label: 'Магазин',
      value: contactPage.store,
    },
    {
      label: 'Склад',
      value: contactPage.warehouse,
    },
  ]

  return (
    <footer className="bg-[rgb(1,55,186)] text-sm text-white">
      <div className="container">
        <div className="grid gap-10 py-12 md:grid-cols-2 md:gap-12 lg:grid-cols-[1.1fr_1fr_1fr_0.82fr] lg:gap-10 lg:py-14">
          <div className="md:pt-1">
            <Link className="inline-flex items-center gap-2" href="/">
              <SiteLogo className="h-auto w-36 brightness-0 invert lg:w-40" />
              <span className="sr-only">{SITE_NAME}</span>
            </Link>
          </div>

          {locations.map((location) => (
            <div key={location.label}>
              <h3 className="mb-4 text-base font-normal tracking-[0.08em] uppercase text-white/95">
                {location.label}
              </h3>

              <div className="space-y-3 text-sm leading-6 text-white/80">
                {locationRows(location.value).map((row) => {
                  const Icon = row.icon

                  return (
                    <div key={`${location.label}-${row.label}`} className="flex items-start gap-3">
                      <Icon className="mt-1 h-4 w-4 shrink-0 text-white/70" />
                      {row.href ? (
                        <a className="hover:text-white" href={row.href}>
                          {row.value}
                        </a>
                      ) : (
                        <p className="whitespace-pre-line">{row.value}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div>
            <h3 className="mb-4 text-base font-normal tracking-[0.08em] uppercase text-white/95">
              Навигация
            </h3>

            <nav>
              <ul className="space-y-3">
                {(footer.navItems?.length
                  ? footer.navItems
                  : [
                      { id: 'shop', link: { type: 'custom' as const, url: '/shop', label: 'Каталог' } },
                      { id: 'partners', link: { type: 'custom' as const, url: '/partners', label: 'Партньори' } },
                      { id: 'contact', link: { type: 'custom' as const, url: '/contact', label: 'Контакт' } },
                      { id: 'account', link: { type: 'custom' as const, url: '/account', label: 'Профил' } },
                      { id: 'terms', link: { type: 'custom' as const, url: '/terms', label: 'Условия за ползване' } },
                      { id: 'privacy', link: { type: 'custom' as const, url: '/privacy', label: 'Политика за поверителност' } },
                    ]
                ).map((item) => (
                  <li key={item.id}>
                    <CMSLink
                      {...item.link}
                      appearance="inline"
                      className="text-white/82 transition hover:text-white"
                    />
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 bg-[rgb(1,55,186)] py-6 text-sm">
        <div className="container mx-auto flex w-full flex-col items-center gap-1 md:flex-row md:gap-0">
          <p>&copy; 2026 Ibis Electronics. Всички права запазени.</p>
          <hr className="mx-4 hidden h-4 w-px border-l border-white/30 md:inline-block" />
          <p className="md:ml-auto">
            Създаден от{' '}
            <a
              className="text-white"
              href="https://nevoweb.dev"
              rel="noreferrer"
              target="_blank"
            >
              Nevo Web
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
