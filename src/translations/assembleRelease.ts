import { bundleHash, validateBundle, type TranslationBundle } from './transfer'
/** Only unchanged approved products or newly checked translations may enter the release. */
export function assembleEnglishRelease(
  original: TranslationBundle,
  delta: TranslationBundle,
  reconciliation: { rows: { productId: string; status: string; fingerprint?: string }[] },
): TranslationBundle {
  validateBundle(original)
  validateBundle(delta)
  const rows = new Map(reconciliation.rows.map((row) => [row.productId, row]))
  const ready = new Map(
    original.entries
      .filter((entry) => rows.get(entry.productId)?.status === 'ready_to_transfer')
      .map((entry) => [entry.productId, entry]),
  )
  for (const entry of delta.entries) {
    const row = rows.get(entry.productId)
    if (
      !row ||
      !['new_product', 'source_changed'].includes(row.status) ||
      row.fingerprint !== entry.fingerprint
    )
      throw Error('Delta does not match the current product snapshot')
    ready.set(entry.productId, entry)
  }
  const entries = [...ready.values()].sort((a, b) => a.productId.localeCompare(b.productId))
  const excluded: NonNullable<TranslationBundle['excluded']> = reconciliation.rows
    .filter((row) => !ready.has(row.productId) && row.status !== 'deleted_product')
    .map((row) => ({
      productId: row.productId,
      status: row.status === 'invalid_source' ? 'invalid_source' : 'needs_review',
    }))
  const bundle: TranslationBundle = {
    format: 'ibis-approved-english-v1',
    createdAt: new Date().toISOString(),
    entries,
    excluded,
    contentHash: bundleHash(entries),
  }
  validateBundle(bundle)
  return bundle
}
