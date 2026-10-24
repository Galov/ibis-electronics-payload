import type { Locale } from './config'
import english from './commerce.en.json'

export const normalizeUIText = (source: string) => source.replace(/\s+/g, ' ').trim()
export function translateCommerce(
  locale: Locale,
  source: string,
  values: Record<string, string | number> = {},
) {
  const key = normalizeUIText(source)
  const dictionary: Record<string, string> = english
  const replacement = Object.prototype.hasOwnProperty.call(dictionary, key)
    ? dictionary[key]
    : undefined
  const translated =
    locale === 'en' && replacement
      ? `${/^\s/.test(source) ? ' ' : ''}${replacement}${/\s$/.test(source) ? ' ' : ''}`
      : source
  return translated.replace(/\{(\d+)\}/g, (match, index: string) =>
    Object.prototype.hasOwnProperty.call(values, index) ? String(values[index]) : match,
  )
}

export function translateCommerceError(locale: Locale, source: string) {
  const translated = translateCommerce(locale, source)
  return locale === 'en' && /[\u0400-\u04FF]/.test(translated)
    ? 'We could not complete your request. Please check your details and try again.'
    : translated
}
