const { createRequire } = require('node:module')
const { MongoClient, BSON } = createRequire(require.resolve('@payloadcms/db-mongodb'))('mongodb')
const { createReadStream, createWriteStream } = require('node:fs')
const { mkdir, open, writeFile } = require('node:fs/promises')
const { createGzip, createGunzip } = require('node:zlib')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { createInterface } = require('node:readline')
const { createHash } = require('node:crypto')
const path = require('node:path')

const BATCH_SIZE = 500

function completedJobsFilter(now) {
  return {
    completedAt: { $type: 'date', $lt: new Date(now.getTime() - 7 * 86400000) },
    hasError: { $ne: true },
    processing: { $ne: true },
  }
}

function oldVersionIds(versions) {
  const parents = new Map()
  for (const version of versions) {
    if (!version.parent || !(version.updatedAt instanceof Date)) continue
    const parent = String(version.parent)
    if (!parents.has(parent)) parents.set(parent, [])
    parents.get(parent).push(version)
  }
  const ids = []
  for (const group of parents.values()) {
    group.sort((a, b) =>
      b.updatedAt - a.updatedAt || String(b._id).localeCompare(String(a._id)),
    )
    for (const version of group.slice(3)) {
      // Keep Payload's current draft even if legacy timestamps are inconsistent.
      if (version.latest !== true) ids.push(version._id)
    }
  }
  return ids
}

async function* readArchive(filename) {
  const input = createReadStream(filename).pipe(createGunzip())
  const lines = createInterface({ input })
  try {
    for await (const line of lines) yield BSON.EJSON.parse(line, { relaxed: false })
  } finally {
    lines.close()
    input.destroy()
  }
}

async function main() {
  const mode = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!['jobs', 'versions'].includes(mode)) throw new Error('Choose jobs or versions')
  if (process.env.DATABASE_URL == null) throw new Error('DATABASE_URL is required')
  const client = new MongoClient(process.env.DATABASE_URL, { serverSelectionTimeoutMS: 15000 })
  await client.connect()
  try {
    const db = client.db()
    if (db.databaseName !== 'IbisElectronicsPayload') throw new Error('Unexpected database')
    const collection = db.collection(mode === 'jobs' ? 'payload-jobs' : '_products_versions')
    const now = new Date()
    const jobFilter = completedJobsFilter(now)
    let ids
    if (mode === 'versions') {
      const versions = await collection.find({}, {
        projection: { _id: 1, parent: 1, updatedAt: 1, latest: 1 },
      }).toArray()
      ids = oldVersionIds(versions)
    }
    const candidateCount = ids ? ids.length : await collection.countDocuments(jobFilter)
    console.log(JSON.stringify({ mode, apply, cutoff: jobFilter.completedAt.$lt, candidateCount }))
    if (!apply || candidateCount === 0) return

    const root = process.env.MAINTENANCE_ARCHIVE_DIR
    if (!root) throw new Error('MAINTENANCE_ARCHIVE_DIR is required')
    const directory = path.join(root, now.toISOString().replace(/[:.]/g, '-') + '-' + mode)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const filename = path.join(directory, 'records.ejson.gz')
    let archived = 0
    async function* records() {
      const filters = ids
        ? Array.from({ length: Math.ceil(ids.length / BATCH_SIZE) }, (_, index) => ({
            _id: { $in: ids.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE) },
          }))
        : [jobFilter]
      for (const filter of filters) {
        for await (const doc of collection.find(filter)) {
          archived++
          yield BSON.EJSON.stringify(doc, { relaxed: false }) + '\n'
        }
      }
    }
    await pipeline(Readable.from(records()), createGzip(), createWriteStream(filename, { flags: 'wx', mode: 0o600 }))
    const file = await open(filename, 'r')
    try { await file.sync() } finally { await file.close() }
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(filename)) hash.update(chunk)
    let verified = 0
    for await (const doc of readArchive(filename)) {
      if (!doc._id) throw new Error('Archive record without ID')
      verified++
    }
    if (verified !== archived) throw new Error('Archive verification failed')
    const manifest = { mode, createdAt: now, database: db.databaseName, archived, sha256: hash.digest('hex') }
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 })
    console.log(JSON.stringify({ archive: filename, ...manifest }))

    let deleted = 0
    let batch = []
    async function flush() {
      if (!batch.length) return
      const operations = batch.map((doc) => ({
        deleteOne: {
          filter: mode === 'jobs'
            ? { ...jobFilter, _id: doc._id, updatedAt: doc.updatedAt ?? null, completedAt: doc.completedAt }
            : { _id: doc._id, parent: doc.parent, updatedAt: doc.updatedAt, latest: { $ne: true } },
        },
      }))
      // Conditions protect a task or autosaved draft changed since the archive was made.
      const result = await collection.bulkWrite(operations, { ordered: false })
      deleted += result.deletedCount
      batch = []
    }
    for await (const doc of readArchive(filename)) {
      batch.push(doc)
      if (batch.length === BATCH_SIZE) await flush()
    }
    await flush()
    const stats = await db.stats()
    const result = { ...manifest, deleted, skippedChangedOrRemoved: archived - deleted, dataSize: stats.dataSize, indexSize: stats.indexSize }
    await writeFile(path.join(directory, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 })
    console.log(JSON.stringify(result))
  } finally {
    await client.close()
  }
}

module.exports = { completedJobsFilter, oldVersionIds }
if (require.main === module) main().catch((error) => {
  console.error(error.name, error.message)
  process.exitCode = 1
})
