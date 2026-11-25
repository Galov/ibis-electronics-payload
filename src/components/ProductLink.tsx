'use client'

import type { ComponentProps } from 'react'
import Link from '@/i18n/Link'
import { useLocale } from '@/i18n/provider'
import type { Locale } from '@/i18n/config'
import { productHref } from '@/i18n/productHref'

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  product: { slug?: string | null; englishSlug?: string | null }
  locale?: Locale
}
export function ProductLink({ product, locale, ...props }: Props) {
  const currentLocale = useLocale()
  return <Link {...props} href={productHref(product, locale || currentLocale)} />
}
