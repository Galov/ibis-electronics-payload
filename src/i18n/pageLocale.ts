import { isLocale, type Locale } from './config'

export type PageLocaleParams = Promise<{ locale?: Locale }>
export async function getPageLocale(params?: PageLocaleParams): Promise<Locale> {
  const value = (await params)?.locale
  return isLocale(value) ? value : 'bg'
}
