'use client'

import { useLocale } from './provider'
import { formatDateTime } from '@/utilities/formatDateTime'
export function LocaleDate({ date }: { date: string }) {
  const locale = useLocale()
  return locale === 'en'
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Europe/Sofia',
      }).format(new Date(date))
    : formatDateTime({ date })
}
