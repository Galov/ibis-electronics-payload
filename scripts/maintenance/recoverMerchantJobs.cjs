const { createRequire } = require('node:module')
const { MongoClient } = createRequire(require.resolve('@payloadcms/db-mongodb'))('mongodb')
const { readFile } = require('node:fs/promises')

const HOUR = 60 * 60 * 1000
const activityDirectory = '/tmp/ibis-merchant-active'

async function isWorkerActive(id) {
  let marker
  try {
    marker = JSON.parse(await readFile(activityDirectory + '/' + id + '.json', 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
  if (!Number.isSafeInteger(marker.pid) || marker.pid < 1 || !marker.startTime) {
    throw new Error('Invalid activity marker for job ' + id)
  }
  try {
    const stat = await readFile('/proc/' + marker.pid + '/stat', 'utf8')
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] === marker.startTime
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return false
    throw error
  }
}

async function recover(db, apply = false, active = isWorkerActive, now = new Date()) {
  const jobs = db.collection('payload-jobs')
  const filter = {
    taskSlug: { $in: ['syncMerchantProduct', 'reconcileMerchantProducts'] },
    queue: 'merchant',
    processing: true,
    hasError: { $ne: true },
    completedAt: null,
    updatedAt: { $type: 'date', $lt: new Date(now.getTime() - HOUR) },
  }
  let recovered = 0
  let activeWorkers = 0
  let candidates = 0
  for await (const job of jobs.find(filter)) {
    candidates++
    if (await active(String(job._id))) {
      activeWorkers++
      console.warn(JSON.stringify({ event: 'merchant-recovery-active-worker', jobID: String(job._id), lastUpdate: job.updatedAt }))
      continue
    }
    if (!apply) continue
    const result = await jobs.updateOne(
      { ...filter, _id: job._id, updatedAt: job.updatedAt },
      { $set: { processing: false, updatedAt: now } },
    )
    recovered += result.modifiedCount
    console.log(JSON.stringify({
      event: 'merchant-job-recovered', jobID: String(job._id),
      previousUpdatedAt: job.updatedAt, recoveredAt: now, changed: result.modifiedCount === 1,
    }))
  }
  const result = { event: 'merchant-recovery-check', at: now, apply, candidates, recovered, activeWorkers }
  console.log(JSON.stringify(result))
  return result
}

async function main() {
  const client = new MongoClient(process.env.DATABASE_URL, { serverSelectionTimeoutMS: 15000 })
  try {
    await client.connect()
    const db = client.db()
    if (db.databaseName !== 'IbisElectronicsPayload') throw new Error('Unexpected database')
    await recover(db, process.argv.includes('--apply'))
  } finally {
    await client.close()
  }
}

module.exports = { recover, isWorkerActive }
if (require.main === module) main().catch(error => {
  console.error(error.name, error.message)
  process.exitCode = 1
})
