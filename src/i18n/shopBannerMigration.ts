export const shopBannerNames = ['topBanner', 'bottomBanner', 'productBanner'] as const

/** Convert only legacy banner groups. Existing BG/EN values are never overwritten. */
export function planShopBannerLocalization(doc: Record<string, unknown>) {
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const name of shopBannerNames) {
    const value = doc[name]
    if (value == null) continue
    if (typeof value !== 'object' || Array.isArray(value)) throw Error(`Invalid banner: ${name}`)
    if (Object.hasOwn(value, 'bg') || Object.hasOwn(value, 'en')) {
      if (Object.keys(value).some((key) => !['bg', 'en'].includes(key)))
        throw Error(`Mixed legacy and localized banner: ${name}`)
      continue
    }
    if (Object.keys(value).some((key) => !['image', 'url', 'openInNewTab'].includes(key)))
      throw Error(`Unexpected banner fields: ${name}`)
    before[name] = value
    after[name] = { bg: value }
  }
  return { before, after }
}
