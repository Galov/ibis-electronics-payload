import { assembleEnglishRelease } from '../../src/translations/assembleRelease.ts'
import { translationState } from '../../src/translations/state.ts'
// Local-only transport and rehearsal. Never imports Payload config or reads .env.
import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import { openAITranslationProvider } from '../../src/translations/provider.ts'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  localTranslationURI,
  assertLocalTranslationURI,
  sourceText,
  sourceFingerprint,
  missingEnglishFields,
  translationPaths,
} from './translationCore.ts'
import {
  bundleHash,
  validateBundle,
  englishText,
  reconcileTranslations,
  transferDecision,
  guardedTextFilter,
} from '../../src/translations/transfer.ts'
import { mongoTranslationStore } from '../../src/translations/mongoStore.mjs'
import { normalizeProductTexts, compareSnapshot } from './reconcileEnglishSnapshot.mjs'
import { prepareProductTranslation, runProductTranslation } from '../../src/translations/engine.ts'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dir = path.join(root, '.local-notes/product-translation/release')
const bundleFile = path.join(dir, 'approved-english.json')
const projection = {
  sku: 1,
  title: 1,
  description: 1,
  shortDescription: 1,
  'meta.title': 1,
  'meta.description': 1,
}
const require = createRequire(import.meta.url)
export async function withLocalDatabase(fn) {
  assertLocalTranslationURI(localTranslationURI)
  const { MongoClient, ObjectId } = require(
    require.resolve('mongodb', {
      paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))],
    }),
  )
  const client = new MongoClient(localTranslationURI, {
    serverSelectionTimeoutMS: 15000,
    writeConcern: { w: 'majority', j: true },
  })
  try {
    await client.connect()
    return await fn(client.db('ibis_bg_en_test'), client, ObjectId)
  } finally {
    await client.close()
  }
}
async function save(file, value) {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.tmp`
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  await fs.rename(temporary, file)
}
export async function exportApproved(db) {
  const ledger = await db
    .collection('local_translation_jobs')
    .find(
      { status: { $in: ['completed', 'skipped_existing'] } },
      { projection: { productId: 1, fingerprint: 1 } },
    )
    .toArray()
  const ready = new Set(ledger.map((job) => `${job.productId}:${job.fingerprint}`))
  const entries = []
  const excluded = []
  for await (const product of db.collection('products').find({}, { projection }).sort({ _id: 1 })) {
    let source
    try {
      source = sourceText(product)
    } catch {
      excluded.push({ productId: String(product._id), status: 'invalid_source' })
      continue
    }
    const productId = String(product._id),
      fingerprint = sourceFingerprint(source)
    if (!ready.has(`${productId}:${fingerprint}`) || missingEnglishFields(product, source).length) {
      excluded.push({ productId, status: 'needs_review' })
      continue
    }
    entries.push({
      productId,
      sku: product.sku ?? '',
      source,
      fingerprint,
      english: englishText(product),
    })
  }
  const bundle = {
    format: 'ibis-approved-english-v1',
    createdAt: new Date().toISOString(),
    entries,
    excluded,
    contentHash: bundleHash(entries),
  }
  validateBundle(bundle)
  return bundle
}
export async function applyApprovedLocally(db, client, ObjectId, bundle) {
  validateBundle(bundle)
  /** @type {Record<string, number>} */
  const counts = {}
  for (const entry of bundle.entries) {
    const session = client.startSession()
    let status
    try {
      await session.withTransaction(
        async () => {
          const product = await db
            .collection('products')
            .findOne({ _id: new ObjectId(entry.productId) }, { session })
          if (!product) {
            status = 'deleted_since_export'
            return
          }
          const decision = transferDecision(product, entry)
          status = decision.status
          if (!['copy', 'already_present'].includes(status)) return
          if (status === 'copy') {
            const result = await db
              .collection('products')
              .updateOne(
                guardedTextFilter(product._id, product.sku, decision.source, decision.before),
                { $set: decision.patch },
                { session },
              )
            if (result.matchedCount !== 1) throw Error('Concurrent product text change')
          }
          // Baseline and text are committed together. No timestamps, stock, price or hooks touched.
          await db.collection('product_english_state').updateOne(
            { _id: entry.productId },
            {
              $set: {
                ...translationState(
                  entry.productId,
                  entry.fingerprint,
                  entry.source,
                  entry.english,
                ),
                bundleHash: bundle.contentHash,
              },
              $unset: { source: '', english: '' },
            },
            { upsert: true, session },
          )
        },
        { writeConcern: { w: 'majority', j: true } },
      )
    } finally {
      await session.endSession()
    }
    counts[status] = (counts[status] || 0) + 1
  }
  return counts
}
export async function main(args = process.argv.slice(2)) {
  const [command, ...extra] = args
  const snapshotFile =
    ['stage-delta', 'export-delta'].includes(command) && extra.length === 1 ? extra[0] : undefined
  const paidLimit =
    command === 'run-delta' && extra.includes('--allow-paid-api') && extra.length === 2
      ? Number(extra.find((value) => /^--max-products=\d+$/.test(value))?.split('=')[1])
      : 0
  if (
    (['stage-delta', 'export-delta'].includes(command)
      ? !snapshotFile
      : command === 'run-delta'
        ? !(paidLimit >= 1 && paidLimit <= 500)
        : extra.length) ||
    ![
      'export',
      'plan',
      'apply-local',
      'queue',
      'recover-saved',
      'stage-delta',
      'run-delta',
      'export-delta',
    ].includes(command)
  )
    throw Error(
      'Usage: englishLifecycle.mjs export|plan|apply-local|queue|recover-saved|stage-delta snapshot.json|run-delta --max-products=N --allow-paid-api|export-delta (isolated local DB only)',
    )
  await withLocalDatabase(async (db, client, ObjectId) => {
    if (command === 'run-delta') {
      const lock = path.join(dir, 'delta-worker.lock')
      await fs.mkdir(lock)
      try {
        const key = dotenv.parse(
          await fs.readFile(path.join(root, '.env.openai-local')),
        ).OPENAI_API_KEY
        if (!key?.startsWith('sk-')) throw Error('Missing local translation key')
        process.env.OPENAI_API_KEY = key
        process.env.IBIS_EN_TRANSLATION_API_ENABLED = 'true'
        const store = mongoTranslationStore(db, client, (id) => new ObjectId(id), { delta: true })
        const counts = {}
        let processed = 0
        for await (const job of db
          .collection('english_release_delta_jobs')
          .find({ status: { $in: ['pending', 'response_saved'] } })
          .sort({ _id: 1 })
          .limit(paidLimit)) {
          const status = await runProductTranslation(store, job.id, openAITranslationProvider)
          counts[status] = (counts[status] || 0) + 1
          processed++
          console.log(JSON.stringify({ processed, status }))
        }
        const totals = await db
          .collection('english_release_delta_jobs')
          .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
          .toArray()
        await save(path.join(dir, 'delta-status.json'), {
          time: new Date().toISOString(),
          processed,
          counts,
          totals,
        })
        console.log(JSON.stringify({ processed, counts, totals }))
      } finally {
        delete process.env.OPENAI_API_KEY
        delete process.env.IBIS_EN_TRANSLATION_API_ENABLED
        await fs.rm(lock, { recursive: true })
      }
      return
    }
    if (command === 'export-delta') {
      const entries = []
      for await (const job of db
        .collection('english_release_delta_jobs')
        .find({ status: 'completed' })
        .sort({ _id: 1 })) {
        const product = await db
          .collection('english_release_delta_products')
          .findOne({ _id: new ObjectId(job.productId) })
        if (!product) continue
        const source = sourceText(product)
        if (
          sourceFingerprint(source) !== job.fingerprint ||
          missingEnglishFields(product, source).length
        )
          continue
        entries.push({
          productId: job.productId,
          sku: product.sku ?? '',
          source,
          fingerprint: job.fingerprint,
          english: englishText(product),
        })
      }
      const bundle = {
        format: 'ibis-approved-english-v1',
        createdAt: new Date().toISOString(),
        entries,
        contentHash: bundleHash(entries),
      }
      validateBundle(bundle)
      await save(path.join(dir, `delta-english-${bundle.contentHash}.json`), bundle)
      const original = JSON.parse(await fs.readFile(bundleFile, 'utf8'))
      const snapshot = JSON.parse(await fs.readFile(snapshotFile, 'utf8'))
      const reconciliation = compareSnapshot(snapshot.products, original)
      const combined = assembleEnglishRelease(original, bundle, reconciliation)
      const releaseFile = path.join(dir, `ready-english-${combined.contentHash}.json`)
      await save(releaseFile, combined)
      await save(path.join(dir, 'ready-release.json'), {
        time: new Date().toISOString(),
        file: releaseFile,
        ready: combined.entries.length,
        held: combined.excluded.length,
        hash: combined.contentHash,
      })
      console.log(
        JSON.stringify({
          deltaReady: entries.length,
          combinedReady: combined.entries.length,
          held: combined.excluded.length,
          file: releaseFile,
        }),
      )
      return
    }
    if (command === 'export') {
      const bundle = await exportApproved(db)
      try {
        const existing = JSON.parse(await fs.readFile(bundleFile, 'utf8'))
        if (existing.contentHash !== bundle.contentHash)
          throw Error('Approved export is frozen; preserve and review it before replacing')
        if (!existing.excluded) await save(bundleFile, { ...existing, excluded: bundle.excluded })
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        await save(bundleFile, bundle)
      }
      console.log(
        JSON.stringify({
          exported: bundle.entries.length,
          contentHash: bundle.contentHash,
          file: bundleFile,
        }),
      )
      return
    }
    const bundle = JSON.parse(await fs.readFile(bundleFile, 'utf8'))
    validateBundle(bundle)
    if (command === 'stage-delta') {
      const snapshot = JSON.parse(await fs.readFile(snapshotFile, 'utf8'))
      const report = compareSnapshot(snapshot.products, bundle)
      const candidates = new Set(
        report.rows
          .filter((row) => ['new_product', 'source_changed'].includes(row.status))
          .map((row) => row.productId),
      )
      const approved = new Map(bundle.entries.map((row) => [row.productId, row]))
      const store = mongoTranslationStore(db, client, (id) => new ObjectId(id), { delta: true })
      const counts = {}
      for (const original of snapshot.products) {
        const id = String(original._id)
        if (!candidates.has(id)) continue
        const product = normalizeProductTexts(original)
        product._id = new ObjectId(id)
        const entry = approved.get(id),
          currentSource = sourceText(product)
        const manualEnglish =
          entry &&
          translationPaths.some((key) => {
            const value = englishText(original)[key]
            return value && value !== entry.english[key]
          })
        if (entry) {
          for (const key of Object.keys(entry.english)) {
            if (currentSource[key] !== entry.source[key] || !entry.english[key]) continue
            const parts = key.split('.'),
              leaf = parts.pop()
            let parent = product
            for (const part of parts) parent = parent[part]
            if (parent[leaf]?.en) continue
            parent[leaf] = { ...parent[leaf], en: entry.english[key] }
          }
        }
        const session = client.startSession()
        try {
          await session.withTransaction(async () => {
            const exists = await db
              .collection('english_release_delta_products')
              .findOne({ _id: product._id }, { session })
            if (exists) return
            await db.collection('english_release_delta_products').insertOne(product, { session })
            if (entry && !manualEnglish)
              await db.collection('english_release_delta_state').insertOne(
                {
                  _id: id,
                  ...translationState(id, entry.fingerprint, entry.source, englishText(product)),
                },
                { session },
              )
          })
        } finally {
          await session.endSession()
        }
        const result = await prepareProductTranslation(store, id)
        counts[result.status] = (counts[result.status] || 0) + 1
      }
      await save(path.join(dir, 'delta-queue.json'), {
        time: new Date().toISOString(),
        snapshotReadAt: snapshot.readAt,
        counts,
        paidRequests: 0,
      })
      console.log(
        JSON.stringify({ deltaQueue: counts, paidRequests: 0, isolatedCollections: true }),
      )
      return
    }
    if (command === 'apply-local') {
      console.log(JSON.stringify(await applyApprovedLocally(db, client, ObjectId, bundle)))
      return
    }
    const products = await db.collection('products').find({}, { projection }).toArray()
    if (command === 'plan') {
      const decisions = reconcileTranslations(products, bundle)
      /** @type {Record<string, number>} */
      const counts = {}
      for (const decision of decisions) counts[decision.status] = (counts[decision.status] || 0) + 1
      await save(path.join(dir, 'reconciliation.json'), {
        time: new Date().toISOString(),
        target: 'isolated-local-only',
        contentHash: bundle.contentHash,
        counts,
        decisions,
      })
      console.log(JSON.stringify({ counts, target: 'isolated-local-only' }))
      return
    }
    const store = mongoTranslationStore(db, client, (id) => new ObjectId(id))
    /** @type {Record<string, number>} */
    const counts = {}
    if (command === 'queue') {
      for (const product of products) {
        const result = await prepareProductTranslation(store, String(product._id))
        counts[result.status] = (counts[result.status] || 0) + 1
      }
    } else {
      // No provider is supplied: this command cannot issue a paid request.
      for await (const job of db
        .collection('product_english_jobs')
        .find({ status: 'response_saved' })) {
        const status = await runProductTranslation(store, job.id)
        counts[status] = (counts[status] || 0) + 1
      }
    }
    console.log(JSON.stringify(counts))
  })
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      'Local English lifecycle stopped. No production database is supported. Check local DB and input bundle.',
    )
    process.exitCode = 1
  })
