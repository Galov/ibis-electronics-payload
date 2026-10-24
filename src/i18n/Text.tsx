'use client'

import { formatMessage, type MessageKey, type MessageValues } from './messages'
import { useLocale } from './provider'

/** Allows server-rendered shared components to use the locale supplied by their root layout. */
export function Text({ id, values }: { id: MessageKey; values?: MessageValues }) {
  return formatMessage(useLocale(), id, values)
}
