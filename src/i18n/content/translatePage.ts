import english from './pages.en.json'

const textFields = new Set(['text', 'title', 'description', 'label', 'summary', 'eyebrow'])
/** Translate authored text only; IDs, relationships, prices, URLs and block structure stay intact. */
export function translateInfoPage<T>(source: T): { page: T; complete: boolean } {
  let complete = true
  const dictionary: Record<string, string> = english
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (textFields.has(key) && typeof item === 'string' && /[\u0400-\u04FF]/.test(item)) {
          if (!Object.prototype.hasOwnProperty.call(dictionary, item)) complete = false
          return [key, dictionary[item] ?? item]
        }
        return [key, visit(item)]
      }),
    )
  }
  return { page: visit(source) as T, complete }
}
