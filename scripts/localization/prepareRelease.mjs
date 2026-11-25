// Offline only: no database clients, environment loading, API calls or deployment.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { planLocalization } from './plan.ts'
import { validateBundle, transferDecision } from '../../src/translations/transfer.ts'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { BSON } = require(require.resolve('mongodb', { paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))] }))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
export async function inspectArchive(file, expected, visit) {
  const bytes = await fs.readFile(file)
  if (sha(bytes) !== expected.sha256) throw Error('Snapshot archive checksum mismatch')
  let count = 0, offset = 0
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) throw Error('Truncated BSON archive')
    const size = bytes.readInt32LE(offset)
    if (size < 5 || offset + size > bytes.length) throw Error('Invalid BSON archive')
    const doc = BSON.deserialize(bytes.subarray(offset, offset + size), { promoteValues: false, promoteLongs: false })
    await visit(doc)
    offset += size; count++
  }
  if (count !== expected.count) throw Error('Snapshot archive count mismatch')
  return count
}
export async function prepareRelease() {
  const base = path.join(root, '.local-notes/english-release-rehearsal')
  const snapshot = JSON.parse(await fs.readFile(path.join(base, 'snapshot.json'), 'utf8'))
  const preserved = JSON.parse(await fs.readFile(path.join(base, 'preservation.json'), 'utf8'))
  if (!snapshot.complete || !snapshot.snapshotConsistent) throw Error('Complete consistent snapshot required')
  for (const [name, expected] of Object.entries(snapshot.collections))
    if (!preserved.checked?.[name]?.unchanged || preserved.checked[name].documents !== expected.count)
      throw Error('Rehearsal preservation evidence missing')
  const descriptor = JSON.parse(await fs.readFile(path.join(root, '.local-notes/product-translation/release/ready-release.json'), 'utf8'))
  const bundleBytes = await fs.readFile(descriptor.file)
  const bundle = JSON.parse(bundleBytes)
  validateBundle(bundle)
  if (bundle.contentHash !== descriptor.hash || bundle.entries.length !== descriptor.ready)
    throw Error('Translation descriptor mismatch')
  const approved = new Map(bundle.entries.map(entry => [entry.productId, entry]))
  const found = new Set(), counts = {}, migration = {}
  for (const name of ['products', '_products_versions']) {
    let documents = 0, fields = 0
    await inspectArchive(path.join(base, `${name}.bson`), snapshot.collections[name], doc => {
      const key = name === 'products' ? 'products' : 'productVersions'
      const plan = planLocalization({ products: [], categories: [], [key]: [doc] })
      if (plan.patches.length) documents++
      fields += plan.patches.length
      if (name !== 'products') return
      for (const patch of plan.patches) {
        const parts = patch.path.split('.'), leaf = parts.pop()
        let parent = doc
        for (const part of parts) parent = parent[part]
        parent[leaf] = patch.after
      }
      const entry = approved.get(String(doc._id))
      if (!entry) return
      found.add(entry.productId)
      const { status } = transferDecision(doc, entry)
      counts[status] = (counts[status] || 0) + 1
    })
    migration[name] = { documents, fields }
  }
  if (found.size !== approved.size || Object.keys(counts).some(key => !['copy', 'already_present'].includes(key)))
    throw Error('Bundle does not match the rehearsed source')
  const out = path.join(root, '.local-notes/english-release-package', randomUUID())
  await fs.mkdir(out, { recursive: true, mode: 0o700 })
  await fs.writeFile(path.join(out, 'approved-english.json'), bundleBytes, { mode: 0o600, flag: 'wx' })
  const manifest = {
    format: 'ibis-english-release-preparation-v1', preparedAt: new Date().toISOString(),
    sourceSnapshotAt: snapshot.time, schema: 'bg-en-v1', ready: descriptor.ready, held: descriptor.held,
    bundleContentHash: bundle.contentHash, bundleFileSHA256: sha(bundleBytes), migration, transfer: counts,
    rehearsalCollectionsPreserved: Object.keys(snapshot.collections).length,
    productionWritesPerformed: false, deployed: false,
    // This evidence is not authorization, nor a fresh production preflight.
    requires: ['fresh backup', 'pause all product writers including imports and jobs',
      'fresh source comparison', 'transactional migration and transfer with durable receipts',
      'matching build/runtime schema flags', 'explicit deployment approval'],
  }
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ directory: out, ...manifest }, null, 2))
  return manifest
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw Error('Offline preparation accepts no arguments')
  await prepareRelease()
}
