import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import {
  assertLocalTranslationURI,
  localTranslationURI,
  translationPaths,
  sourceText,
  sourceFingerprint,
  missingEnglishFields,
  translationRequest,
  validateTranslation,
  englishPatch,
  readPath,
  batchCustomID,
  translationModel,
  promptVersion,
} from './translationCore.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const directory = path.join(root, '.local-notes/product-translation')
const lock = path.join(directory, 'worker.lock')
const stopFile = path.join(directory, 'STOP')
const activeStates = ['prepared', 'uploaded', 'submitting', 'submission_unknown', 'active']
const terminalStates = ['completed', 'failed', 'expired', 'cancelled']
const require = createRequire(import.meta.url)
let stopping = false

const log = (event, details = {}) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), event, ...details }))
const jobs = (db) => db.collection('local_translation_jobs')
const batches = (db) => db.collection('local_translation_batches')
const jobID = (id, fingerprint) => `${id}:${fingerprint}`

function savePrivate(file, data) {
  const temporary = `${file}.${process.pid}.tmp`
  const fd = fs.openSync(temporary, 'wx', 0o600)
  try {
    fs.writeFileSync(fd, data)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(temporary, file)
}
function acquireLock() {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  if (fs.existsSync(lock)) {
    const ownerFile = path.join(lock, 'pid')
    if (!fs.existsSync(ownerFile))
      throw new Error('Worker lock is being initialized; try again later')
    const pid = Number(fs.readFileSync(ownerFile, 'utf8'))
    if (!Number.isSafeInteger(pid) || pid <= 0)
      throw new Error('Invalid worker lock; review it manually')
    try {
      process.kill(pid, 0)
      throw new Error(`Translation worker already running (PID ${pid})`)
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
    fs.rmSync(lock, { recursive: true })
  }
  fs.mkdirSync(lock)
  fs.writeFileSync(path.join(lock, 'pid'), String(process.pid), { mode: 0o600, flag: 'wx' })
  return () => fs.rmSync(lock, { recursive: true, force: true })
}

async function api(endpoint, options = {}) {
  if (!endpoint.startsWith('/v1/') || endpoint.includes('..'))
    throw new Error('Invalid OpenAI endpoint')
  const keyFile = path.join(root, '.env.openai-local')
  const key = dotenv.parse(fs.readFileSync(keyFile)).OPENAI_API_KEY
  if (!key?.startsWith('sk-')) throw new Error('Missing local OpenAI key')
  const response = await fetch(`https://api.openai.com${endpoint}`, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
    headers: { Authorization: `Bearer ${key}`, ...options.headers },
  })
  if (!response.ok) {
    // Do not print API error bodies: authentication errors can contain key material.
    const error = new Error(`OpenAI HTTP ${response.status}`)
    error.httpStatus = response.status
    throw error
  }
  return response
}

export async function prepareQueue(db) {
  let created = 0
  let existing = 0
  for await (const product of db
    .collection('products')
    .find(
      {},
      {
        projection: { title: 1, description: 1, shortDescription: 1, meta: 1, sku: 1 },
      },
    )
    .sort({ _id: 1 })) {
    const productId = String(product._id)
    let source
    try {
      source = sourceText(product)
    } catch {
      await jobs(db).updateOne(
        { _id: `${productId}:invalid` },
        {
          $setOnInsert: {
            productId: product._id,
            sku: product.sku,
            status: 'invalid_source',
            createdAt: new Date(),
          },
        },
        { upsert: true },
      )
      continue
    }
    const fingerprint = sourceFingerprint(source)
    const id = jobID(productId, fingerprint)
    if (await jobs(db).findOne({ _id: id }, { projection: { _id: 1 } })) {
      existing++
      continue
    }
    const fields = missingEnglishFields(product, source)
    // If an earlier translated revision exists, an existing EN text cannot be
    // assumed to match this newer BG revision. Do not overwrite or relabel it.
    const previous = await jobs(db).findOne({
      productId: product._id,
      fingerprint: { $ne: fingerprint },
      status: { $in: ['completed', 'skipped_existing'] },
    })
    const status = previous ? 'stale_source' : fields.length ? 'pending' : 'skipped_existing'
    await jobs(db).insertOne({
      _id: id,
      productId: product._id,
      sku: product.sku,
      fingerprint,
      source,
      fields,
      enBefore: Object.fromEntries(fields.map((p) => [p, readPath(product, `${p}.en`) ?? null])),
      customId: batchCustomID(productId, fingerprint),
      status,
      model: translationModel,
      promptVersion,
      createdAt: new Date(),
    })
    created++
  }
  log('queue_prepared', { created, alreadyJournaled: existing })
}

export async function applySavedTranslation(db, job, validate = validateTranslation) {
  const product = await db.collection('products').findOne({ _id: job.productId })
  const mark = async (status, extra = {}) =>
    jobs(db).updateOne({ _id: job._id }, { $set: { status, ...extra, updatedAt: new Date() } })
  let currentFingerprint
  try {
    currentFingerprint = product && sourceFingerprint(sourceText(product))
  } catch {
    currentFingerprint = null
  }
  if (!product || currentFingerprint !== job.fingerprint) {
    await mark('stale_source')
    return false
  }
  validate(job.source, job.fields, job.translation)
  const patch = englishPatch(job.translation, job.source)
  if (Object.entries(patch).every(([p, v]) => readPath(product, p) === v)) {
    await mark('completed', { appliedAt: new Date() })
    return true
  }
  if (job.fields.some((p) => (readPath(product, `${p}.en`) ?? null) !== job.enBefore[p])) {
    await mark('needs_review', { errorCode: 'EN_CHANGED_DURING_TRANSLATION' })
    return false
  }
  const conditions = translationPaths.map((p) => ({ [`${p}.bg`]: { $eq: job.source[p] } }))
  for (const p of job.fields) conditions.push({ [`${p}.en`]: { $eq: job.enBefore[p] } })
  const saved = await db
    .collection('products')
    .updateOne({ _id: job.productId, $and: conditions }, { $set: patch })
  if (saved.matchedCount !== 1) {
    await mark('stale_source')
    return false
  }
  // A crash here is safe: the saved response is durable, and the check above
  // recognizes an already applied patch without sending a new API request.
  await mark('completed', { appliedAt: new Date() })
  return true
}

async function recoverReady(db) {
  for await (const job of jobs(db).find({ status: 'response_ready' }))
    await applySavedTranslation(db, job)
}

export async function reconcileSubmission(db, batch, request = api) {
  let after
  // Creation is never repeated after an ambiguous network failure. Find the
  // original server-side batch by our unique metadata instead.
  for (let page = 0; page < 100; page++) {
    const response = await request(
      `/v1/batches?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`,
    )
    const list = await response.json()
    const found = list.data.find((item) => item.metadata?.local_batch_id === batch._id)
    if (found) {
      await batches(db).updateOne(
        { _id: batch._id },
        { $set: { status: 'active', remoteId: found.id, recoveredAt: new Date() } },
      )
      log('submission_recovered', { batch: batch._id })
      return
    }
    if (!list.has_more || !list.data.length) break
    after = list.data.at(-1).id
  }
  await batches(db).updateOne(
    { _id: batch._id },
    { $set: { status: 'submission_unknown', checkedAt: new Date() } },
  )
  log('submission_held_for_reconciliation', { batch: batch._id })
}

export async function submit(db, batch, request = api) {
  const selected = await jobs(db)
    .find({ _id: { $in: batch.jobIds } })
    .sort({ _id: 1 })
    .toArray()
  if (selected.length !== batch.jobIds.length) throw new Error('Incomplete local batch manifest')
  await jobs(db).updateMany(
    { _id: { $in: batch.jobIds }, status: 'pending' },
    { $set: { status: 'queued', batchId: batch._id } },
  )
  if (batch.status === 'prepared') {
    const body =
      selected
        .map((job) =>
          JSON.stringify({
            custom_id: job.customId,
            method: 'POST',
            url: '/v1/responses',
            body: translationRequest(job.source, job.fields),
          }),
        )
        .join('\n') + '\n'
    savePrivate(path.join(directory, `${batch._id}.input.jsonl`), body)
    const form = new FormData()
    form.set('purpose', 'batch')
    form.set('file', new Blob([body], { type: 'application/jsonl' }), `${batch._id}.jsonl`)
    const response = await request('/v1/files', { method: 'POST', body: form })
    const file = await response.json()
    await batches(db).updateOne(
      { _id: batch._id },
      { $set: { status: 'uploaded', inputFileId: file.id } },
    )
    batch = { ...batch, status: 'uploaded', inputFileId: file.id }
  }
  if (batch.status !== 'uploaded') return
  await batches(db).updateOne(
    { _id: batch._id },
    { $set: { status: 'submitting', submitStartedAt: new Date() } },
  )
  try {
    const response = await request('/v1/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_file_id: batch.inputFileId,
        endpoint: '/v1/responses',
        completion_window: '24h',
        metadata: { local_batch_id: batch._id, purpose: 'ibis-local-product-en' },
      }),
    })
    const remote = await response.json()
    await batches(db).updateOne(
      { _id: batch._id },
      { $set: { status: 'active', remoteId: remote.id, submittedAt: new Date() } },
    )
    log('batch_submitted', { batch: batch._id, products: selected.length })
  } catch (error) {
    // Explicit 4xx responses did not create a batch. Preserve the uploaded input
    // and back off; a lost response/5xx is ambiguous and must be reconciled.
    const knownRejected = [400, 401, 403, 404, 413, 422, 429].includes(error.httpStatus)
    await batches(db).updateOne(
      { _id: batch._id },
      {
        $set: {
          status: knownRejected ? 'uploaded' : 'submission_unknown',
          errorCode: error.httpStatus ? `HTTP_${error.httpStatus}` : 'SUBMISSION_UNKNOWN',
        },
      },
    )
    if ([400, 401, 403, 404, 413, 422].includes(error.httpStatus))
      throw new Error(`Batch rejected (HTTP ${error.httpStatus}); stopping for review`)
    log('batch_submission_deferred', { batch: batch._id, ambiguous: !knownRejected })
  }
}

async function readOutput(fileId, batchId, kind) {
  const file = path.join(directory, `${batchId}.${kind}.jsonl`)
  if (!fs.existsSync(file)) {
    const response = await api(`/v1/files/${encodeURIComponent(fileId)}/content`)
    savePrivate(file, await response.text())
  }
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

async function harvest(db, batch, remote) {
  const selected = await jobs(db)
    .find({ _id: { $in: batch.jobIds } })
    .toArray()
  const lookup = new Map(selected.map((job) => [job.customId, job]))
  const seen = new Set()
  for (const [kind, fileId] of [
    ['output', remote.output_file_id],
    ['errors', remote.error_file_id],
  ]) {
    if (!fileId) continue
    for (const row of await readOutput(fileId, batch._id, kind)) {
      const job = lookup.get(row.custom_id)
      if (!job) throw new Error('Output contains an unknown product identity')
      if (seen.has(row.custom_id)) throw new Error('Duplicate product in batch output')
      seen.add(row.custom_id)
      const latest = await jobs(db).findOne({ _id: job._id })
      if (['completed', 'skipped_existing', 'needs_review', 'stale_source'].includes(latest.status))
        continue
      if (latest.status === 'response_ready') {
        await applySavedTranslation(db, latest)
        continue
      }
      const result = row.response?.body
      if (row.response?.status_code !== 200 || result?.status !== 'completed') {
        const expired = row.error?.code === 'batch_expired'
        await jobs(db).updateOne(
          { _id: job._id },
          {
            $set: {
              status: expired ? 'pending' : 'needs_review',
              errorCode: expired ? 'BATCH_EXPIRED_NOT_EXECUTED' : 'API_RESPONSE_FAILED',
              lastBatchId: batch._id,
            },
            $unset: { batchId: '' },
          },
        )
        continue
      }
      const text = (result.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === 'output_text')
        .map((item) => item.text)
        .join('')
      let translation
      try {
        translation = JSON.parse(text)
        validateTranslation(job.source, job.fields, translation)
      } catch {
        await jobs(db).updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'needs_review',
              errorCode: 'TRANSLATION_VALIDATION_FAILED',
              rawOutput: text,
              responseId: result.id,
              usage: result.usage,
              lastBatchId: batch._id,
            },
          },
        )
        continue
      }
      await jobs(db).updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'response_ready',
            translation,
            responseId: result.id,
            model: result.model,
            usage: result.usage,
            receivedAt: new Date(),
            lastBatchId: batch._id,
          },
        },
      )
      await applySavedTranslation(db, { ...job, translation })
    }
  }
  // A terminal batch with no result is not silently resubmitted or charged again.
  for (const job of selected) {
    if (!seen.has(job.customId))
      await jobs(db).updateOne(
        { _id: job._id, status: 'queued', batchId: batch._id },
        {
          $set: {
            status: 'needs_review',
            errorCode: 'NO_RESULT_IN_TERMINAL_BATCH',
            lastBatchId: batch._id,
          },
        },
      )
  }
  await batches(db).updateOne(
    { _id: batch._id },
    {
      $set: {
        status: 'harvested',
        remoteStatus: remote.status,
        requestCounts: remote.request_counts,
        remoteErrors: remote.errors?.data?.map((item) => ({ code: item.code, line: item.line })),
        harvestedAt: new Date(),
      },
    },
  )
  log('batch_harvested', { batch: batch._id, state: remote.status, counts: remote.request_counts })
}

async function report(db) {
  const counts = await jobs(db)
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    .toArray()
  const batchCounts = await batches(db)
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    .toArray()
  const summary = {
    time: new Date().toISOString(),
    database: 'ibis_bg_en_test',
    jobs: Object.fromEntries(counts.map((row) => [row._id, row.count])),
    batches: Object.fromEntries(batchCounts.map((row) => [row._id, row.count])),
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  savePrivate(path.join(directory, 'status.json'), JSON.stringify(summary, null, 2) + '\n')
  log('status', summary)
  return summary
}

async function run(db, { batchSize, maxActive, once, submitNew = true }) {
  fs.rmSync(stopFile, { force: true })
  if (submitNew) await prepareQueue(db)
  do {
    try {
      await recoverReady(db)
      const active = await batches(db)
        .find({ status: { $in: activeStates } })
        .sort({ createdAt: 1 })
        .toArray()
      for (const batch of active) {
        if (['submitting', 'submission_unknown'].includes(batch.status))
          await reconcileSubmission(db, batch)
        else if (['prepared', 'uploaded'].includes(batch.status)) {
          if (submitNew) await submit(db, batch)
        } else {
          const response = await api(`/v1/batches/${encodeURIComponent(batch.remoteId)}`)
          const remote = await response.json()
          await batches(db).updateOne(
            { _id: batch._id },
            {
              $set: {
                remoteStatus: remote.status,
                requestCounts: remote.request_counts,
                checkedAt: new Date(),
              },
            },
          )
          if (terminalStates.includes(remote.status)) await harvest(db, batch, remote)
        }
      }
      let occupied = await batches(db).countDocuments({ status: { $in: activeStates } })
      while (submitNew && occupied < maxActive && !stopping && !fs.existsSync(stopFile)) {
        const pending = await jobs(db)
          .find({ status: 'pending' })
          .sort({ _id: 1 })
          .limit(batchSize)
          .toArray()
        if (!pending.length) break
        const batch = {
          _id: randomUUID(),
          status: 'prepared',
          jobIds: pending.map((job) => job._id),
          createdAt: new Date(),
        }
        await batches(db).insertOne(batch)
        await submit(db, batch)
        occupied++
      }
      const summary = await report(db)
      if (!summary.jobs.pending && !occupied && !summary.jobs.response_ready) break
      if (once || stopping || fs.existsSync(stopFile)) break
    } catch (error) {
      const retryable =
        [408, 429, 500, 502, 503, 504].includes(error.httpStatus) ||
        [
          'MongoNetworkError',
          'MongoServerSelectionError',
          'MongoNetworkTimeoutError',
          'TimeoutError',
        ].includes(error.name) ||
        (error.name === 'TypeError' && error.message === 'fetch failed')
      if (!retryable || once) throw error
      log('connection_retry', {
        code: error.httpStatus ? `HTTP_${error.httpStatus}` : 'NETWORK_UNAVAILABLE',
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 30000))
  } while (!stopping && !fs.existsSync(stopFile))
  log('worker_stopped', { resumable: true })
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...options] = argv
  if (!['prepare', 'status', 'run', 'collect', 'stop'].includes(command))
    throw new Error(
      'Usage: translateProducts.mjs prepare|status|run|collect|stop [--batch-size=N] [--max-active=N] [--once]',
    )
  const values = { batchSize: 100, maxActive: 2, once: false }
  for (const option of options) {
    if (option === '--once') values.once = true
    else if (/^--batch-size=\d+$/.test(option)) values.batchSize = Number(option.split('=')[1])
    else if (/^--max-active=\d+$/.test(option)) values.maxActive = Number(option.split('=')[1])
    else throw new Error('Unknown translation option')
  }
  if (
    values.batchSize < 1 ||
    values.batchSize > 500 ||
    values.maxActive < 1 ||
    values.maxActive > 4
  )
    throw new Error('Unsafe batch limits')
  if (command === 'stop') {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    fs.writeFileSync(stopFile, new Date().toISOString(), { mode: 0o600 })
    log('stop_requested', { remoteBatchesContinue: true })
    return
  }
  assertLocalTranslationURI(localTranslationURI)
  const release = command === 'status' ? () => {} : acquireLock()
  const { MongoClient } = require(
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
    const db = client.db('ibis_bg_en_test')
    if (command !== 'status') {
      await jobs(db).createIndex({ status: 1, _id: 1 })
      await jobs(db).createIndex({ productId: 1 })
      await batches(db).createIndex({ status: 1 })
    }
    if (command === 'prepare') {
      await prepareQueue(db)
      await report(db)
    } else if (command === 'status') await report(db)
    else {
      process.on('SIGINT', () => {
        stopping = true
      })
      process.on('SIGTERM', () => {
        stopping = true
      })
      await run(db, {
        ...values,
        once: command === 'collect' || values.once,
        submitNew: command !== 'collect',
      })
    }
  } finally {
    await client.close()
    release()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    log('worker_failed', {
      reason: error.httpStatus
        ? `OPENAI_HTTP_${error.httpStatus}`
        : error.message?.startsWith('Batch rejected')
          ? error.message
          : 'LOCAL_OR_NETWORK_ERROR_CHECK_PRIVATE_STATE',
    })
    process.exitCode = 1
  })
}
