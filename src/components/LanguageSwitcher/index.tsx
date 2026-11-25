'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getPathLocale, hasEnglishRoute, localizeHref } from '@/i18n/config'
import { messages } from '@/i18n/messages'
import { rememberStorefront } from '@/i18n/storefrontPreference'
import { ROMANIAN_STOREFRONT } from '@/ecommerce/checkoutDestination'
import { ChevronDown } from 'lucide-react'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const href = `${pathname}${query ? `?${query}` : ''}`
  const locale = getPathLocale(pathname)
  const languageHref = (language: 'bg' | 'en') =>
    hasEnglishRoute(pathname)
      ? localizeHref(href, language)
      : language === 'en'
        ? '/en'
        : '/magazin'
  if (compact)
    return (
      <div className="relative inline-flex items-center">
        <select
          aria-label={messages[locale].language}
          value={locale}
          className="min-h-11 appearance-none rounded-sm bg-transparent pl-3 pr-8 text-sm font-medium text-inherit outline-none focus-visible:ring-2 focus-visible:ring-current"
          onChange={(event) => {
            const language = event.target.value as 'bg' | 'en' | 'ro'
            rememberStorefront(language)
            if (language === 'ro') window.location.assign(ROMANIAN_STOREFRONT)
            else
              router.push(
                hasEnglishRoute(pathname)
                  ? localizeHref(
                      `${pathname}${window.location.search}${window.location.hash}`,
                      language,
                    )
                  : languageHref(language),
              )
          }}
        >
          <option className="bg-white text-[rgb(1,55,186)]" value="bg">
            Български
          </option>
          <option className="bg-white text-[rgb(1,55,186)]" value="en">
            English
          </option>
          <option className="bg-white text-[rgb(1,55,186)]" value="ro">
            Română ↗
          </option>
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 size-3.5" />
      </div>
    )
  return (
    <nav aria-label={messages[locale].language} className="flex items-center gap-3 text-sm">
      {(['bg', 'en'] as const).map((language) => (
        <Link
          key={language}
          aria-current={language === locale ? 'page' : undefined}
          href={languageHref(language)}
          hrefLang={language}
          lang={language}
          onClick={(event) => {
            rememberStorefront(language)
            // Read at click time to preserve query/hash without requiring a Suspense boundary.
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            )
              return
            event.preventDefault()
            router.push(
              hasEnglishRoute(pathname)
                ? localizeHref(
                    `${pathname}${window.location.search}${window.location.hash}`,
                    language,
                  )
                : languageHref(language),
            )
          }}
          className={`inline-flex min-h-11 items-center px-2 transition-opacity hover:opacity-100 ${language === locale ? 'font-semibold underline decoration-2 underline-offset-4' : 'opacity-80'}`}
        >
          {language === 'bg' ? 'Български' : 'English'}
        </Link>
      ))}
      <a
        href={ROMANIAN_STOREFRONT}
        hrefLang="ro"
        lang="ro"
        onClick={() => rememberStorefront('ro')}
        className="inline-flex min-h-11 items-center gap-1 px-2 opacity-80 transition-opacity hover:opacity-100"
      >
        Română <span aria-hidden="true">↗</span>
      </a>
    </nav>
  )
}
