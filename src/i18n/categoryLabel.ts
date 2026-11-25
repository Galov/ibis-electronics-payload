import type { Locale } from './config'
import english from './content/categories.en.json'
/** UI labels only. Stored names, IDs and slugs remain unchanged for integrations. */
export function categoryLabel(title: string, locale: Locale) {
  const key = title.replace(/\s+/g, ' ').trim()
  const labels: Record<string, string> = english
  return locale === 'en' && Object.hasOwn(labels, key) ? labels[key] : title
}
