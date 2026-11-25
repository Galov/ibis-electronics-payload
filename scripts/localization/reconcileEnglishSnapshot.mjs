// Offline snapshot comparison only. Never opens a database or loads site configuration.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateBundle } from '../../src/translations/transfer.ts'
import {
  sourceText,
  sourceFingerprint,
  translationPaths,
  readPath,
  isEmptyProductText,
} from './translationCore.ts'
export function normalizeProductTexts(product) {
  const result = { ...product, meta: { ...(product.meta || {}) } }
  for (const key of translationPaths) {
    const value = readPath(product, key)
    const wrapped = typeof value === 'string' || value === null ? { bg: value } : value
    if (key.startsWith('meta.')) result.meta[key.slice(5)] = wrapped
    else result[key] = wrapped
  }
  return result
}
export function compareSnapshot(products, bundle) {
  validateBundle(bundle)
  const approved = new Map(bundle.entries.map((row) => [row.productId, row]))
  const held = new Map((bundle.excluded || []).map((row) => [row.productId, row.status]))
  const rows = [],
    seen = new Set()
  for (const product of products) {
    const id =
      typeof product._id === 'object' ? product._id?.$oid : String(product._id ?? product.id)
    if (!/^[a-f0-9]{24}$/.test(id) || seen.has(id)) throw Error('Invalid snapshot product identity')
    seen.add(id)
    let source
    try {
      source = sourceText(normalizeProductTexts(product))
    } catch {
      rows.push({ productId: id, status: 'invalid_source' })
      continue
    }
    const entry = approved.get(id)
    if (!entry) {
      rows.push({
        productId: id,
        status: held.get(id) || 'new_product',
        fingerprint: sourceFingerprint(source),
        translateFields: translationPaths.filter((key) => !isEmptyProductText(source[key])),
      })
      continue
    }
    if ((product.sku ?? '') !== entry.sku) {
      rows.push({ productId: id, status: 'identity_changed' })
      continue
    }
    const same = sourceFingerprint(source) === entry.fingerprint
    rows.push({
      productId: id,
      status: same ? 'ready_to_transfer' : 'source_changed',
      fingerprint: sourceFingerprint(source),
      requiresMigration: translationPaths.some((key) => typeof readPath(product, key) === 'string'),
      reuseFields: translationPaths.filter(
        (key) => source[key] === entry.source[key] && !isEmptyProductText(source[key]),
      ),
      translateFields: translationPaths.filter(
        (key) => source[key] !== entry.source[key] && !isEmptyProductText(source[key]),
      ),
    })
  }
  for (const entry of bundle.entries)
    if (!seen.has(entry.productId))
      rows.push({ productId: entry.productId, status: 'deleted_product' })
  /** @type {Record<string, number>} */
  const counts = {}
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1
  return {
    format: 'ibis-english-reconciliation-v1',
    sourceReadOnly: true,
    bundleHash: bundle.contentHash,
    counts,
    rows,
  }
}
export async function main(args = process.argv.slice(2)) {
  if (args.length !== 3)
    throw Error(
      'Usage: reconcileEnglishSnapshot.mjs snapshot.json approved-english.json output.json',
    )
  const [source, bundleFile, out] = args
  const snapshot = JSON.parse(await fs.readFile(source, 'utf8'))
  const bundle = JSON.parse(await fs.readFile(bundleFile, 'utf8'))
  if (!Array.isArray(snapshot.products)) throw Error('Expected raw product snapshot')
  const report = compareSnapshot(snapshot.products, bundle)
  await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ readOnly: true, counts: report.counts, report: out }))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main()
