import { createHash } from 'node:crypto'
import {
  translationPaths,
  sourceText,
  sourceFingerprint,
  missingEnglishFields,
  readPath,
  type SourceText,
} from '../../scripts/localization/translationCore'

export type EnglishText = Record<string, string | null>
export type ApprovedTranslation = {
  productId: string
  sku: string
  source: SourceText
  fingerprint: string
  english: EnglishText
}
export type TranslationBundle = {
  format: 'ibis-approved-english-v1'
  createdAt: string
  contentHash: string
  entries: ApprovedTranslation[]
  excluded?: { productId: string; status: 'needs_review' | 'invalid_source' }[]
}
export const englishText = (product: unknown): EnglishText =>
  Object.fromEntries(
    translationPaths.map((path) => [path, readPath(product, `${path}.en`) ?? null]),
  ) as EnglishText
export const englishHash = (english: EnglishText) =>
  createHash('sha256')
    .update(JSON.stringify(translationPaths.map((path) => english[path] ?? null)))
    .digest('hex')
export const bundleHash = (entries: ApprovedTranslation[]) =>
  createHash('sha256').update(JSON.stringify(entries)).digest('hex')
export function validateBundle(bundle: TranslationBundle) {
  if (
    bundle.format !== 'ibis-approved-english-v1' ||
    !Array.isArray(bundle.entries) ||
    bundle.contentHash !== bundleHash(bundle.entries)
  )
    throw Error('Invalid or changed English translation bundle')
  for (const row of bundle.excluded || []) {
    if (
      !/^[a-f0-9]{24}$/.test(row.productId) ||
      !['needs_review', 'invalid_source'].includes(row.status) ||
      bundle.entries.some((entry) => entry.productId === row.productId)
    )
      throw Error('Invalid excluded product')
  }
  const ids = new Set<string>()
  for (const entry of bundle.entries) {
    if (
      !/^[a-f0-9]{24}$/.test(entry.productId) ||
      ids.has(entry.productId) ||
      typeof entry.sku !== 'string'
    )
      throw Error('Invalid or duplicate product identity')
    ids.add(entry.productId)
    if (
      Object.keys(entry.source).sort().join() !== [...translationPaths].sort().join() ||
      Object.keys(entry.english).sort().join() !== [...translationPaths].sort().join() ||
      Object.values(entry.source).some((value) => value !== null && typeof value !== 'string') ||
      Object.values(entry.english).some((value) => value !== null && typeof value !== 'string') ||
      !entry.source.title?.trim() ||
      entry.fingerprint !== sourceFingerprint(entry.source)
    )
      throw Error('Unsafe product translation fields')
    const doc: Record<string, unknown> = Object.fromEntries(
      translationPaths
        .filter((path) => !path.includes('.'))
        .map((path) => [path, { bg: entry.source[path], en: entry.english[path] }]),
    )
    doc.meta = Object.fromEntries(
      (['title', 'description'] as const).map((key) => [
        key,
        { bg: entry.source[`meta.${key}`], en: entry.english[`meta.${key}`] },
      ]),
    )
    if (missingEnglishFields(doc, entry.source).length)
      throw Error('Incomplete approved translation')
  }
}
export type TransferDecision = {
  productId: string
  status:
    | 'copy'
    | 'already_present'
    | 'source_changed'
    | 'identity_changed'
    | 'english_conflict'
    | 'requires_migration'
    | 'invalid_source'
  patch?: Record<string, string | null>
  source?: SourceText
  before?: EnglishText
}
export function transferDecision(
  product: Record<string, unknown>,
  approved: ApprovedTranslation,
): TransferDecision {
  const productId = String(product._id ?? product.id)
  if (productId !== approved.productId || (product.sku ?? '') !== approved.sku)
    return { productId, status: 'identity_changed' }
  let source: SourceText
  try {
    source = sourceText(product)
  } catch {
    return {
      productId,
      status: translationPaths.some((path) => typeof readPath(product, path) === 'string')
        ? 'requires_migration'
        : 'invalid_source',
    }
  }
  if (sourceFingerprint(source) !== approved.fingerprint)
    return { productId, status: 'source_changed' }
  const before = englishText(product)
  // An existing different EN field is an editorial change, never an invitation to overwrite.
  if (
    translationPaths.some(
      (path) =>
        before[path] !== null && before[path] !== '' && before[path] !== approved.english[path],
    )
  )
    return { productId, status: 'english_conflict' }
  const patch = Object.fromEntries(
    translationPaths
      .filter((path) => before[path] !== approved.english[path] && approved.english[path] !== null)
      .map((path) => [`${path}.en`, approved.english[path]]),
  )
  return {
    productId,
    status: Object.keys(patch).length ? 'copy' : 'already_present',
    source,
    before,
    patch,
  }
}
/** Exact source/EN checks permit concurrent price/stock changes but not text edits. */
export function guardedTextFilter(
  id: unknown,
  sku: string,
  source: SourceText,
  before: EnglishText,
) {
  return {
    _id: id,
    sku,
    $and: translationPaths.flatMap((path) => [
      { [`${path}.bg`]: { $eq: source[path] } },
      { [`${path}.en`]: { $eq: before[path] } },
    ]),
  }
}
export function reconcileTranslations(
  products: Record<string, unknown>[],
  bundle: TranslationBundle,
) {
  validateBundle(bundle)
  const excluded = new Map((bundle.excluded || []).map((entry) => [entry.productId, entry.status]))
  const approved = new Map(bundle.entries.map((entry) => [entry.productId, entry]))
  const seen = new Set<string>()
  const result: { productId: string; status: string }[] = []
  for (const product of products) {
    const id = String(product._id ?? product.id)
    if (seen.has(id)) throw Error('Duplicate target product')
    seen.add(id)
    const entry = approved.get(id)
    result.push(
      entry
        ? transferDecision(product, entry)
        : { productId: id, status: excluded.get(id) || 'new_since_export' },
    )
  }
  for (const entry of bundle.entries)
    if (!seen.has(entry.productId))
      result.push({ productId: entry.productId, status: 'deleted_since_export' })
  return result
}
