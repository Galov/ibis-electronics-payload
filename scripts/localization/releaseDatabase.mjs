// Production-capable release tooling. Never loads .env; no hooks, jobs or API providers.
// This file only runs on an explicit CLI invocation. Tested on isolated local databases.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { planLocalization } from './plan.ts'
import { validateBundle, transferDecision } from '../../src/translations/transfer.ts'
import { readPath } from './translationCore.ts'
const require = createRequire(import.meta.url)
const { MongoClient, BSON } = require(require.resolve('mongodb', { paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))] }))
const raw = { promoteValues: false, promoteLongs: false }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export function targetIdentity(uri) {
  const url = new URL(uri)
  if (!['mongodb:', 'mongodb+srv:'].includes(url.protocol) || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname))
    throw Error('Explicit MongoDB database name required')
  // Credentials and query secrets are never included in the plan or logs.
  return hash(`${url.protocol}//${url.host}${url.pathname}`)
}
const allowed = new Set(['title', 'description', 'shortDescription', 'meta.title', 'meta.description'])
export function validatePlan(plan) {
  if (plan.format !== 'ibis-english-db-release-v1' || !/^[a-f0-9]{64}$/.test(plan.target) || !Array.isArray(plan.rows)) throw Error('Invalid release plan')
  const seen = new Set()
  for (const row of plan.rows) {
    const prefix = row.collection === 'products' ? '' : row.collection === '_products_versions' ? 'version.' : null
    if (prefix === null || !row.id || !row.before || !row.after) throw Error('Invalid release target')
    const key = `${row.collection}:${row.id}`
    if (seen.has(key)) throw Error('Duplicate release target')
    seen.add(key)
    const keys = Object.keys(row.before)
    if (!keys.length || keys.sort().join() !== Object.keys(row.after).sort().join()) throw Error('Invalid release fields')
    for (const key of keys) {
      if (!key.startsWith(prefix) || !allowed.has(key.slice(prefix.length))) throw Error('Non-text release field refused')
      const before = row.before[key], after = row.after[key]
      if (!before || typeof before.exists !== 'boolean' || (before.exists && before.value !== null && typeof before.value !== 'string' && typeof before.value !== 'object')) throw Error('Invalid before image')
      if (before.exists && before.value && typeof before.value === 'object' &&
        (Array.isArray(before.value) || !Object.hasOwn(before.value,'bg') || Object.keys(before.value).some(k => !['bg','en'].includes(k)) || Object.values(before.value).some(v => v !== null && typeof v !== 'string')))
        throw Error('Invalid localized before image')
      if (!after || typeof after !== 'object' || Array.isArray(after) || !Object.hasOwn(after, 'bg') || Object.keys(after).some(k => !['bg','en'].includes(k)) || Object.values(after).some(v => v !== null && typeof v !== 'string')) throw Error('Invalid localized text')
      const originalBG = before.exists && before.value && typeof before.value === 'object' ? before.value.bg : before.exists ? before.value : null
      if (!isDeepStrictEqual(after.bg, originalBG)) throw Error('BG text change refused')
    }
  }
}
export async function createPlan(db, target, bundle) {
  validateBundle(bundle)
  const entries = new Map(bundle.entries.map(e => [e.productId,e])), found = new Set(), rows = []
  /** @type {Record<string, number>} */
  const counts = {}
  for (const collection of ['products', '_products_versions']) {
    const logical = collection === 'products' ? 'products' : 'productVersions'
    for await (const doc of db.collection(collection).find({}, raw).sort({_id:1})) {
      const patches = planLocalization({ products:[], categories:[], [logical]:[doc] }).patches
      const before = {}, after = {}
      const migrated = BSON.deserialize(BSON.serialize(doc), raw)
      for (const patch of patches) {
        before[patch.path] = { exists:true, value:patch.before }
        after[patch.path] = patch.after
        const parts = patch.path.split('.'), leaf = parts.pop()
        let parent = migrated
        for (const part of parts) parent = parent[part]
        parent[leaf] = patch.after
      }
      if (collection === 'products') {
        const entry = entries.get(String(doc._id))
        if (entry) {
          found.add(entry.productId)
          const decision = transferDecision(migrated,entry)
          counts[decision.status] = (counts[decision.status] || 0) + 1
          if (decision.status === 'copy') for (const [key,value] of Object.entries(decision.patch)) {
            const field = key.slice(0,-3), previous = readPath(doc,field)
            if (!Object.hasOwn(before,field)) before[field] = { exists:previous !== undefined, ...(previous !== undefined ? {value:previous} : {}) }
            after[field] = { ...(after[field] || previous || {bg:null}), en:value }
          }
        }
      }
      if (Object.keys(after).length) rows.push({ collection, id:doc._id, ...(collection === 'products' ? {sku:doc.sku ?? null} : {}), before, after })
    }
  }
  counts.deleted_since_export = entries.size - found.size
  const plan = { format:'ibis-english-db-release-v1', createdAt:new Date().toISOString(), target, bundleHash:bundle.contentHash, counts, rows }
  validatePlan(plan)
  return plan
}
function filterFor(row, reverse) {
  return { _id:row.id, ...(row.collection === 'products' ? {sku:row.sku} : {}), $and:Object.keys(row.before).map(key => {
    const expected = reverse ? {exists:true,value:row.after[key]} : row.before[key]
    return { [key]: expected.exists ? {$exists:true,$eq:expected.value} : {$exists:false} }
  }) }
}
export async function executePlan(db, plan, reverse = false) {
  validatePlan(plan)
  const counts = { changed:0, alreadyApplied:0, conflicts:0 }
  for (const row of reverse ? [...plan.rows].reverse() : plan.rows) {
    const set = {}, unset = {}
    for (const key of Object.keys(row.before)) {
      if (!reverse) set[key] = row.after[key]
      else if (row.before[key].exists) set[key] = row.before[key].value
      else unset[key] = ''
    }
    const update = { ...(Object.keys(set).length ? {$set:set} : {}), ...(Object.keys(unset).length ? {$unset:unset} : {}) }
    const result = await db.collection(row.collection).updateOne(filterFor(row,reverse),update)
    if (result.matchedCount === 1) counts.changed++
    else if (await db.collection(row.collection).findOne(filterFor(row,!reverse),{projection:{_id:1}})) counts.alreadyApplied++
    else { counts.conflicts++; throw Error(`Release stopped on concurrent text/identity change; completed=${counts.changed}. Resume only after review.`) }
  }
  return counts
}
// A release file can exceed MongoDB's per-document size; it is never inserted into MongoDB.
export function serializePlan(plan) {
  validatePlan(plan)
  const size = BSON.calculateObjectSize(plan)
  if (size > 512 * 1024 * 1024) throw Error('Release plan exceeds local file safety limit')
  return BSON.serialize(plan, { minInternalBufferSize: size })
}
export async function main(args = process.argv.slice(2)) {
  const [command,file,confirmation] = args
  if (!['preflight','apply','rollback'].includes(command) || !file || args.length !== (command === 'preflight' ? 2 : 3))
    throw Error('Usage: releaseDatabase.mjs preflight bundle.json | apply|rollback plan.bson --confirm=SHA256')
  const uri = process.env.IBIS_RELEASE_DATABASE_URL
  if (!uri) throw Error('IBIS_RELEASE_DATABASE_URL must be explicitly provided; .env is never loaded')
  const target = targetIdentity(uri)
  let plan
  if (command !== 'preflight') {
    const bytes = await fs.readFile(file)
    if (confirmation !== `--confirm=${hash(bytes)}` || process.env.IBIS_RELEASE_WRITERS_PAUSED !== 'yes' || process.env.IBIS_RELEASE_BACKUP_VERIFIED !== 'yes') throw Error('Verified backup, paused writers and exact plan checksum required')
    plan = BSON.deserialize(bytes,raw)
    validatePlan(plan)
    if (plan.target !== target) throw Error('Release target mismatch')
  }
  const client = new MongoClient(uri,{serverSelectionTimeoutMS:15000,writeConcern:{w:'majority',j:true}})
  try {
    await client.connect()
    const db = client.db()
    if (command === 'preflight') {
      const bundle = JSON.parse(await fs.readFile(file,'utf8'))
      plan = await createPlan(db,target,bundle)
      const directory = path.join(path.dirname(path.resolve(file)),`database-plan-${Date.now()}`)
      await fs.mkdir(directory,{mode:0o700})
      const bytes = serializePlan(plan), planFile = path.join(directory,'plan.bson')
      const handle = await fs.open(planFile,'wx',0o600)
      try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
      console.log(JSON.stringify({planFile,sha256:hash(bytes),rows:plan.rows.length,counts:plan.counts,writesPerformed:false}))
    } else console.log(JSON.stringify(await executePlan(db,plan,command === 'rollback')))
  } finally { await client.close() }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
