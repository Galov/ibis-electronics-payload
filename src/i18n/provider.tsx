'use client'

import { createContext, useContext, useCallback, type ReactNode } from 'react'
import { defaultLocale, type Locale } from './config'
import { messages, formatMessage, type MessageKey, type MessageValues } from './messages'

const LocaleContext = createContext<Locale>(defaultLocale)
export function LocaleProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}
export const useLocale = () => useContext(LocaleContext)
export const useMessages = () => messages[useLocale()]

export const useTranslate = () => {
  const locale = useLocale()
  return useCallback(
    (key: MessageKey, values?: MessageValues) => formatMessage(locale, key, values),
    [locale],
  )
}
