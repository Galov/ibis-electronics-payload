// Explicit route-only migration. No Payload hooks, provider, or external storefront calls.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  planEnglishSlugBackfill,
  ensureEnglishSlugIndexes,
  englishRouteFields,
} from '../../src/i18n/englishProductSlugs.mjs'
const require = createRequire(import.meta.url)
const { MongoClient, BSON } = require(
  require.resolve('mongodb', { paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))] }),
)
export const routeDocumentHash = (doc) => {
  const copy = { ...doc }
  for (const key of englishRouteFields) delete copy[key]
  return createHash('sha256').update(BSON.serialize(copy)).digest('hex')
}
/** @param {any} db @param {{apply?: boolean, backupDir?: string}} options */
export async function backfillEnglishSlugs(db, { apply = false, backupDir } = {}) {
  if (
    apply &&
    (await db
      .collection('payload-jobs')
      .countDocuments({ queue: 'english-products', processing: true, completedAt: null }))
  )
    throw Error('Active English jobs: stop writers and wait before applying route migration')
  const products = db.collection('products'),
    docs = await products.find({}).sort({ _id: 1 }).toArray()
  const rows = planEnglishSlugBackfill(docs)
  const report = {
    products: docs.length,
    alreadyReady: docs.filter((d) => d.englishSlug).length,
    planned: rows.length,
    withoutEnglishTitle: docs.filter((d) => !d.title?.en?.trim()).length,
    legacyAliases: rows.filter((r) => r.patch.englishLegacySlug).length,
    estimatedMetadataBytes: rows.reduce((n, r) => n + BSON.serialize(r.patch).length, 0),
    applied: 0,
  }
  if (!apply) return report
  if (!backupDir) throw Error('A private backup directory is required')
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 })
  // Preserve BSON types, versions are untouched because every save hook preserves current metadata.
  await fs.writeFile(
    path.join(backupDir, 'products.before.bson'),
    Buffer.concat(docs.map((d) => BSON.serialize(d))),
    { mode: 0o600, flag: 'wx' },
  )
  await fs.writeFile(path.join(backupDir, 'route-plan.json'), JSON.stringify(rows, null, 2), {
    mode: 0o600,
    flag: 'wx',
  })
  await ensureEnglishSlugIndexes(products)
  const before = new Map(docs.map((d) => [String(d._id), d]))
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250)
    const operations = batch.map((row) => {
      const doc = before.get(row.id)
      const filter = {
        _id: doc._id,
        'title.en': doc.title.en,
        slug: doc.slug,
        ...Object.fromEntries(
          englishRouteFields.map((k) => [k, Object.hasOwn(doc, k) ? doc[k] : { $exists: false }]),
        ),
      }
      return { updateOne: { filter, update: { $set: row.patch } } }
    })
    const result = await products.bulkWrite(operations, { ordered: true })
    if (result.matchedCount !== batch.length)
      throw Error('Concurrent product change: migration stopped; review backup before retry')
    report.applied += result.matchedCount
  }
  const after = await products.find({}).sort({ _id: 1 }).toArray()
  if (
    after.length !== docs.length ||
    after.some((d) => routeDocumentHash(d) !== routeDocumentHash(before.get(String(d._id))))
  )
    throw Error('Concurrent non-route change detected')
  if (planEnglishSlugBackfill(after).length) throw Error('Incomplete slug migration')
  await fs.writeFile(
    path.join(backupDir, 'result.json'),
    JSON.stringify({ ...report, verifiedOnlyRouteMetadataChanged: true }, null, 2),
    { mode: 0o600 },
  )
  return { ...report, verifiedOnlyRouteMetadataChanged: true }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const uri = process.env.DATABASE_URL,
    parsed = new URL(uri || 'invalid:')
  const local =
    parsed.protocol === 'mongodb:' &&
    parsed.hostname === '127.0.0.1' &&
    parsed.port === '27028' &&
    ['/ibis_en_release_rehearsal', '/ibis_bg_en_test'].includes(parsed.pathname)
  const production =
    parsed.protocol === 'mongodb+srv:' &&
    parsed.hostname === 'primary-cluster.qki0ar6.mongodb.net' &&
    parsed.pathname === '/IbisElectronicsPayload'
  const apply = process.argv.includes('--apply')
  if (!local && !(production && process.env.IBIS_EN_SLUG_PRODUCTION === 'confirmed'))
    throw Error('Unapproved migration database')
  const backup = process.argv.find((a) => a.startsWith('--backup='))?.slice(9)
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    writeConcern: { w: 'majority', j: true },
  })
  try {
    await client.connect()
    console.log(
      JSON.stringify(await backfillEnglishSlugs(client.db(), { apply, backupDir: backup })),
    )
  } finally {
    await client.close()
  }
}
