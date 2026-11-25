import { isDeepStrictEqual } from 'node:util'

const sharedProjection = (doc: Record<string, unknown>) => {
  const {
    title,
    description,
    shortDescription,
    updatedAt,
    meta,
    englishSlug,
    englishLegacySlug,
    ...shared
  } = doc
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const {
      title: seoTitle,
      description: seoDescription,
      ...sharedMeta
    } = meta as Record<string, unknown>
    shared.meta = sharedMeta
  } else if (meta !== undefined) shared.meta = meta
  return shared
}

// Fail open for notifications: suppress only a proven EN text-only update.
// A price, stock, publication, image or relationship change must still propagate.
export const isEnglishTextOnlyProductChange = ({
  doc,
  previousDoc,
  operation,
  locale,
}: {
  doc: Record<string, unknown>
  previousDoc?: Record<string, unknown> | null
  operation: string
  locale?: unknown
}): boolean =>
  operation === 'update' &&
  locale === 'en' &&
  !!previousDoc &&
  isDeepStrictEqual(sharedProjection(doc), sharedProjection(previousDoc))
