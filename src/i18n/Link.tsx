'use client'

import NextLink from 'next/link'
import type { ComponentProps } from 'react'
import { localizeHref } from './config'
import { useLocale } from './provider'

/** Shared screens can keep their existing paths while retaining the selected language. */
export default function LocalizedLink({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale()
  const localizedHref =
    typeof href === 'string'
      ? localizeHref(href, locale)
      : { ...href, pathname: href.pathname ? localizeHref(href.pathname, locale) : href.pathname }
  return <NextLink {...props} href={localizedHref} />
}
