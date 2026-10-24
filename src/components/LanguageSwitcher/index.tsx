'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getPathLocale, hasEnglishRoute, localizeHref } from '@/i18n/config'
import { messages } from '@/i18n/messages'

export function LanguageSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const href = `${pathname}${query ? `?${query}` : ''}`
  const locale = getPathLocale(pathname)
  if (!hasEnglishRoute(pathname)) return null
  return (
    <nav aria-label={messages[locale].language} className="flex items-center gap-3 text-sm">
      {(['bg', 'en'] as const).map((language) => (
        <Link
          key={language}
          aria-current={language === locale ? 'page' : undefined}
          href={localizeHref(href, language)}
          hrefLang={language}
          lang={language}
          onClick={(event) => {
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
              localizeHref(`${pathname}${window.location.search}${window.location.hash}`, language),
            )
          }}
          className={language === locale ? 'font-semibold underline underline-offset-4' : ''}
        >
          {language === 'bg' ? 'Български' : 'English'}
        </Link>
      ))}
    </nav>
  )
}
