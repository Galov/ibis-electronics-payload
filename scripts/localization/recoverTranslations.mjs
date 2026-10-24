// Local/offline replay only. No API key is loaded and external fetch is blocked.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { applySavedTranslation } from './translateProducts.mjs'
import {
  localTranslationURI,
  assertLocalTranslationURI,
  normalizeSavedTranslation,
  englishPatch,
  translationPaths,
} from './translationCore.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const directory = path.join(root, '.local-notes/product-translation/recovery-v3')
const require = createRequire(import.meta.url)
const { MongoClient, BSON } = require(
  require.resolve('mongodb', { paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))] }),
)
const version = 'safe-lists-units-v3'
const hash = (value) => createHash('sha256').update(value).digest('hex')
function withoutEN(doc) {
  const copy = BSON.EJSON.parse(BSON.EJSON.stringify(doc))
  for (const p of translationPaths) {
    const keys = p.split('.')
    const parent = keys.length === 1 ? copy : copy.meta
    if (parent?.[keys.at(-1)] && typeof parent[keys.at(-1)] === 'object')
      delete parent[keys.at(-1)].en
  }
  return BSON.EJSON.stringify(copy)
}
export function recoveryCandidate(job) {
  if (job.errorCode !== 'TRANSLATION_VALIDATION_FAILED')
    return { accepted: false, reason: 'INCOMPLETE_OR_API_RESPONSE_REQUIRES_REVIEW' }
  try {
    const saved = JSON.parse(job.rawOutput)
    const result = normalizeSavedTranslation(job.source, job.fields, saved)
    return { accepted: true, ...result }
  } catch (error) {
    return { accepted: false, reason: error.message }
  }
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.some((arg) => arg !== '--apply'))
    throw new Error('Usage: recoverTranslations.mjs [--apply]')
  const apply = argv.includes('--apply')
  globalThis.fetch = () =>
    Promise.reject(new Error('External API calls are disabled during local recovery'))
  assertLocalTranslationURI(localTranslationURI)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const client = new MongoClient(localTranslationURI, { writeConcern: { w: 'majority', j: true } })
  try {
    await client.connect()
    const db = client.db('ibis_bg_en_test')
    const queue = await db
      .collection('local_translation_jobs')
      .find({ status: 'needs_review' })
      .sort({ _id: 1 })
      .toArray()
    const accepted = [],
      held = []
    for (const job of queue) {
      const candidate = recoveryCandidate(job)
      if (candidate.accepted) accepted.push({ job, candidate })
      else held.push({ id: job._id, sku: job.sku, reason: candidate.reason })
    }
    const report = {
      mode: apply ? 'apply' : 'dry-run',
      version,
      total: queue.length,
      eligible: accepted.length,
      held: held.length,
      reasons: {},
      recovered: 0,
      conflicts: 0,
    }
    for (const item of held) report.reasons[item.reason] = (report.reasons[item.reason] || 0) + 1
    if (apply) {
      const backup = path.join(directory, `before-${Date.now()}.ejsonl`)
      const fd = fs.openSync(backup, 'wx', 0o600)
      try {
        for (const { job } of accepted) {
          const product = await db.collection('products').findOne({ _id: job.productId })
          fs.writeSync(fd, BSON.EJSON.stringify({ job, product }) + '\n')
        }
        fs.fsyncSync(fd)
      } finally {
        fs.closeSync(fd)
      }
      for (const { job, candidate } of accepted) {
        const session = client.startSession()
        try {
          const recovered = await session.withTransaction(async () => {
            const scoped = {
              collection: (name) => ({
                findOne: (filter, options = {}) =>
                  db.collection(name).findOne(filter, { ...options, session }),
                updateOne: (filter, update, options = {}) =>
                  db.collection(name).updateOne(filter, update, { ...options, session }),
              }),
            }
            const latest = await scoped
              .collection('local_translation_jobs')
              .findOne({ _id: job._id })
            if (
              latest.status !== 'needs_review' ||
              hash(latest.rawOutput || '') !== hash(job.rawOutput || '')
            ) {
              return false
            }
            const before = await scoped.collection('products').findOne({ _id: job.productId })
            await scoped.collection('local_translation_jobs').updateOne(
              { _id: job._id, status: 'needs_review' },
              {
                $set: {
                  status: 'response_ready',
                  translation: candidate.translation,
                  recovery: {
                    version,
                    sourceResponseHash: hash(job.rawOutput),
                    restoredCodeFields: candidate.restoredCodeFields,
                    previousErrorCode: job.errorCode,
                    at: new Date(),
                  },
                },
              },
            )
            const ok = await applySavedTranslation(scoped, {
              ...job,
              translation: candidate.translation,
            })
            if (!ok) {
              return false
            }
            const after = await scoped.collection('products').findOne({ _id: job.productId })
            if (!isDeepStrictEqual(withoutEN(before), withoutEN(after)))
              throw new Error('Non-English product data changed; transaction aborted')
            const patch = englishPatch(candidate.translation, job.source)
            for (const p of Object.keys(patch)) {
              const keys = p.split('.')
              let value = after
              for (const key of keys) value = value?.[key]
              if (value !== patch[p]) throw new Error('Recovery verification failed')
            }
            await scoped
              .collection('local_translation_jobs')
              .updateOne({ _id: job._id }, { $unset: { errorCode: '' } })
            return true
          })
          if (recovered) report.recovered++
          else report.conflicts++
        } finally {
          await session.endSession()
        }
      }
    }
    const details = {
      ...report,
      eligibleJobs: accepted.map(({ job, candidate }) => ({
        id: job._id,
        sku: job.sku,
        restoredCodeFields: candidate.restoredCodeFields,
      })),
      heldJobs: held,
    }
    const file = path.join(directory, `${apply ? 'applied' : 'dry-run'}-${Date.now()}.json`)
    fs.writeFileSync(file, JSON.stringify(details, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await client.close()
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error('Local recovery stopped:', error.message)
    process.exitCode = 1
  })
