// Full snapshot rehearsal. Remote client is READ ONLY; every mutation uses fixed loopback DB.
import fs from 'node:fs/promises'
import { createWriteStream, createReadStream } from 'node:fs'
import { once } from 'node:events'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { planLocalization } from './plan.ts'
import { translationPaths, readPath } from './translationCore.ts'
import { applyApprovedLocally } from './englishLifecycle.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const rehearsalURI =
  'mongodb://127.0.0.1:27028/ibis_en_release_rehearsal?replicaSet=ibisEnLocal&directConnection=true'
export const rehearsalName = 'ibis_en_release_rehearsal'
const dir = path.join(root, '.local-notes/english-release-rehearsal')
const require = createRequire(import.meta.url)
const { MongoClient, BSON } = require(
  require.resolve('mongodb', { paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))] }),
)
const rawOptions = { promoteValues: false, promoteLongs: false }
const logical = (name) =>
  name === 'products' ? 'products' : name === '_products_versions' ? 'productVersions' : null
const report = async (name, value) =>
  fs.writeFile(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
function normalized(doc, collection) {
  const which = logical(collection)
  if (!which) return doc
  const copy = BSON.deserialize(BSON.serialize(doc), rawOptions)
  const data = which === 'productVersions' ? copy.version : copy
  for (const field of translationPaths) {
    const parts = field.split('.')
    const leaf = parts.pop()
    let parent = data
    for (const part of parts) parent = parent?.[part]
    const value = parent?.[leaf]
    if (value && typeof value === 'object' && Object.hasOwn(value, 'bg')) parent[leaf] = value.bg
  }
  return copy
}
export async function collectionDigest(db, name, normalize = false) {
  const hash = createHash('sha256')
  let count = 0
  for await (const doc of db.collection(name).find({}, rawOptions).sort({ _id: 1 })) {
    hash.update(BSON.serialize(normalize ? normalized(doc, name) : doc))
    count++
  }
  return { count, sha256: hash.digest('hex') }
}
async function fileDigest(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
export async function localRehearsal(fn) {
  const uri = new URL(rehearsalURI)
  if (
    uri.protocol !== 'mongodb:' ||
    uri.hostname !== '127.0.0.1' ||
    uri.port !== '27028' ||
    uri.pathname !== `/${rehearsalName}`
  )
    throw Error('Unsafe rehearsal target')
  const client = new MongoClient(rehearsalURI, {
    serverSelectionTimeoutMS: 15000,
    writeConcern: { w: 'majority', j: true },
  })
  try {
    await client.connect()
    return await fn(client.db(rehearsalName), client)
  } finally {
    await client.close()
  }
}
async function cloneSnapshot() {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  const configuration = dotenv.parse(await fs.readFile(path.join(root, '.env')))
  const uri = configuration.DATABASE_URL
  if (!uri?.startsWith('mongodb+srv://') || !new URL(uri).hostname.endsWith('.mongodb.net'))
    throw Error('Unexpected snapshot source')
  const sourceClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 2,
    readPreference: 'primary',
  })
  try {
    await sourceClient.connect()
    const source = sourceClient.db()
    await localRehearsal(async (target) => {
      if ((await target.listCollections().toArray()).length)
        throw Error('Rehearsal database already exists; refusing overwrite')
      const names = (await source.listCollections({}, { nameOnly: false }).toArray())
        .filter((row) => row.type === 'collection' && !row.name.startsWith('system.'))
        .map((row) => row.name)
        .sort()
      const session = sourceClient.startSession({ snapshot: true })
      const manifest = {
        time: new Date().toISOString(),
        target: rehearsalName,
        snapshotConsistent: true,
        collections: {},
        skippedTTLIndexes: [],
        complete: false,
      }
      try {
        for (const name of names) {
          if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw Error('Unexpected collection name')
          await target.createCollection(name)
          const file = path.join(dir, `${name}.bson`)
          const out = createWriteStream(file, { mode: 0o600, flags: 'wx' })
          const finished = once(out, 'finish')
          const hash = createHash('sha256')
          let count = 0,
            batch = []
          const flush = async () => {
            if (batch.length) {
              await target.collection(name).insertMany(batch, { ordered: true })
              batch = []
            }
          }
          try {
            for await (const doc of source
              .collection(name)
              .find({}, { ...rawOptions, session, batchSize: 500, maxTimeMS: 240000 })
              .sort({ _id: 1 })) {
              const bytes = BSON.serialize(doc)
              hash.update(bytes)
              if (!out.write(bytes)) await once(out, 'drain')
              batch.push(doc)
              count++
              if (batch.length === 500) await flush()
            }
            await flush()
          } finally {
            out.end()
            await finished
          }
          const expected = { count, sha256: hash.digest('hex') }
          const actual = await collectionDigest(target, name)
          if (
            expected.count !== actual.count ||
            expected.sha256 !== actual.sha256 ||
            (await fileDigest(file)) !== expected.sha256
          )
            throw Error(`Clone verification failed: ${name}`)
          const indexes = await source.collection(name).listIndexes().toArray()
          for (const index of indexes) {
            if (index.name === '_id_') continue
            if (index.expireAfterSeconds !== undefined) {
              manifest.skippedTTLIndexes.push({ collection: name, name: index.name })
              continue
            }
            const { key, name: indexName, v, ns, background, ...options } = index
            await target.collection(name).createIndex(key, { ...options, name: indexName })
          }
          manifest.collections[name] = {
            ...expected,
            indexes: indexes.map(
              ({ key, name, unique, sparse, expireAfterSeconds, partialFilterExpression }) => ({
                key,
                name,
                unique,
                sparse,
                expireAfterSeconds,
                partialFilterExpression,
              }),
            ),
          }
          await report('snapshot.json', manifest)
          console.log(JSON.stringify({ cloned: name, documents: count }))
        }
        manifest.complete = true
        await report('snapshot.json', manifest)
      } finally {
        await session.endSession()
      }
    })
  } finally {
    await sourceClient.close()
  }
}
export async function migrateClone(db, client) {
  const targets = ['products', '_products_versions']
  let total = 0
  // Full preflight before the first migration write.
  for (const name of targets) {
    let count = 0
    for await (const doc of db.collection(name).find({}, rawOptions)) {
      planLocalization({ products: [], categories: [], [logical(name)]: [doc] })
      count++
    }
    console.log(JSON.stringify({ preflight: name, documents: count }))
  }
  for (const name of targets) {
    let writes = [],
      receipts = [],
      modified = 0
    const flush = async () => {
      if (!writes.length) return
      const session = client.startSession()
      const n = writes.length
      try {
        await session.withTransaction(async () => {
          const result = await db.collection(name).bulkWrite(writes, { ordered: true, session })
          if (result.matchedCount !== n) throw Error('Concurrent migration conflict')
          await db
            .collection('english_rehearsal_migration')
            .bulkWrite(receipts, { ordered: true, session })
        })
      } finally {
        await session.endSession()
      }
      modified += n
      writes = []
      receipts = []
    }
    for await (const doc of db.collection(name).find({}, rawOptions).sort({ _id: 1 })) {
      const plan = planLocalization({ products: [], categories: [], [logical(name)]: [doc] })
      if (!plan.patches.length) continue
      const before = Object.fromEntries(plan.patches.map((p) => [p.path, p.before])),
        after = Object.fromEntries(plan.patches.map((p) => [p.path, p.after]))
      writes.push({
        updateOne: {
          filter: {
            _id: doc._id,
            $and: plan.patches.map((p) => ({ [p.path]: { $eq: p.before, $exists: true } })),
          },
          update: { $set: after },
        },
      })
      receipts.push({
        updateOne: {
          filter: { _id: `${name}:${doc._id}` },
          update: {
            $set: { collection: name, documentId: doc._id, before, after, state: 'migrated' },
            $push: { events: { operation: 'forward', at: new Date() } },
          },
          upsert: true,
        },
      })
      if (writes.length === 500) await flush()
    }
    await flush()
    total += modified
    console.log(JSON.stringify({ migrated: name, documents: modified }))
  }
  return { migratedDocuments: total }
}
export async function rollbackReceipt(db, client, receipt) {
  if (!['products', '_products_versions'].includes(receipt.collection))
    throw Error('Unsafe rollback collection')
  const allowed = translationPaths.map(field => receipt.collection === '_products_versions' ? `version.${field}` : field)
  if (Object.keys(receipt.before).some(field => !allowed.includes(field)) ||
      Object.keys(receipt.after).sort().join('|') !== Object.keys(receipt.before).sort().join('|') ||
      Object.entries(receipt.before).some(([field,value]) => (value !== null && typeof value !== 'string') || JSON.stringify(receipt.after[field]) !== JSON.stringify({bg:value})))
    throw Error('Unsafe rollback fields')
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const actual = await db
        .collection(receipt.collection)
        .findOne({ _id: receipt.documentId }, { session })
      if (!actual) throw Error('Missing rollback document')
      if (
        allowed.some((field) => {
          const value = readPath(actual, field)
          return value && typeof value === 'object' && Object.hasOwn(value, 'en')
        })
      )
        throw Error('Rollback refused: translated or changed text')
      for (const [field, expected] of Object.entries(receipt.after)) {
        const value = readPath(actual, field)
        if (JSON.stringify(value) !== JSON.stringify(expected))
          throw Error('Rollback refused: translated or changed text')
      }
      const result = await db.collection(receipt.collection).updateOne(
        {
          _id: receipt.documentId,
          $and: Object.entries(receipt.after).map(([key, value]) => ({ [key]: { $eq: value } })),
        },
        { $set: receipt.before },
        { session },
      )
      if (result.matchedCount !== 1) throw Error('Concurrent rollback conflict')
      await db.collection('english_rehearsal_migration').updateOne(
        { _id: receipt._id },
        {
          $set: { state: 'rolled_back' },
          $push: { events: { operation: 'rollback', at: new Date() } },
        },
        { session },
      )
    })
  } finally {
    await session.endSession()
  }
}
async function verify(db) {
  const snapshot = JSON.parse(await fs.readFile(path.join(dir, 'snapshot.json'), 'utf8'))
  if (!snapshot.complete) throw Error('Incomplete source snapshot')
  const checked = {}
  for (const [name, expected] of Object.entries(snapshot.collections)) {
    const actual = await collectionDigest(db, name, true)
    if (actual.count !== expected.count || actual.sha256 !== expected.sha256)
      throw Error(`Data preservation failed: ${name}`)
    checked[name] = { documents: actual.count, unchanged: true }
  }
  await report('preservation.json', { time: new Date().toISOString(), checked })
  console.log(
    JSON.stringify({
      preservedCollections: Object.keys(checked).length,
      allOriginalDataPreserved: true,
    }),
  )
  return checked
}
export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args
  if (
    rest.length ||
    !['clone', 'migrate', 'transfer', 'verify', 'rollback-probe'].includes(command)
  )
    throw Error('Usage: rehearsal.mjs clone|migrate|transfer|verify|rollback-probe')
  if (command === 'clone') return cloneSnapshot()
  await localRehearsal(async (db, client) => {
    if (command === 'migrate') {
      const result = await migrateClone(db, client)
      await report('migration.json', result)
      await verify(db)
    }
    if (command === 'verify') await verify(db)
    if (command === 'rollback-probe') {
      const receipt = await db
        .collection('english_rehearsal_migration')
        .findOne({ collection: 'products', state: 'migrated' })
      if (!receipt) throw Error('No migration receipt')
      await rollbackReceipt(db, client, receipt)
      await verify(db)
      await migrateClone(db, client)
      await verify(db)
      await report('rollback.json', {
        reversed: true,
        reapplied: true,
        originalDataPreserved: true,
      })
      console.log(JSON.stringify({ rollbackProbe: 'passed' }))
    }
    if (command === 'transfer') {
      const ready = JSON.parse(
        await fs.readFile(
          path.join(root, '.local-notes/product-translation/release/ready-release.json'),
          'utf8',
        ),
      )
      const bundle = JSON.parse(await fs.readFile(ready.file, 'utf8'))
      const counts = await applyApprovedLocally(db, client, BSON.ObjectId, bundle)
      await report('transfer.json', {
        time: new Date().toISOString(),
        counts,
        hash: bundle.contentHash,
      })
      console.log(JSON.stringify({ translationTransfer: counts }))
      await verify(db)
      const translated = bundle.entries.find((entry) => entry.english.title)
      const receipt = await db
        .collection('english_rehearsal_migration')
        .findOne({ _id: `products:${translated.productId}` })
      let refused = false
      try {
        await rollbackReceipt(db, client, receipt)
      } catch (error) {
        if (error.message.includes('Rollback refused')) refused = true
        else throw error
      }
      if (!refused) throw Error('Unsafe rollback was not blocked')
      console.log(JSON.stringify({ rollbackAfterEnglish: 'safely refused' }))
    }
  })
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(
      'Rehearsal stopped:',
      error.message.includes('mongodb') ? 'Database connection error' : error.message,
    )
    process.exitCode = 1
  })
