'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from './provider'
import { localizeHref } from './config'

export function useLocalizedRouter() {
  const router = useRouter()
  const locale = useLocale()
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        options === undefined
          ? router.push(localizeHref(href, locale))
          : router.push(localizeHref(href, locale), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        options === undefined
          ? router.replace(localizeHref(href, locale))
          : router.replace(localizeHref(href, locale), options),
    }),
    [router, locale],
  )
}
