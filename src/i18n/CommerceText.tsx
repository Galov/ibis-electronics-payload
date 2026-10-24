'use client'

import { useCallback } from 'react'
import { useLocale } from './provider'
import { translateCommerce, translateCommerceError } from './commerce'

export function useCommerceTranslation() {
  const locale = useLocale()
  return useCallback(
    (source: string, values?: Record<string, string | number>) =>
      translateCommerce(locale, source, values),
    [locale],
  )
}
export function CommerceText({
  source,
  values,
  error = false,
}: {
  source: string
  values?: Record<string, string | number>
  error?: boolean
}) {
  const locale = useLocale()
  return error ? translateCommerceError(locale, source) : translateCommerce(locale, source, values)
}
