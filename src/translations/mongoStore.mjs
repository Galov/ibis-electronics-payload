// Raw text-only writes deliberately bypass commerce hooks; transactions preserve the journal.
import { translationState } from './state.ts'
import { guardedTextFilter } from './transfer.ts'
import { planEnglishSlugPatch } from '../i18n/englishProductSlugs.mjs'
export function mongoTranslationStore(db, client, toId, { delta = false } = {}) {
  const products = db.collection(delta ? 'english_release_delta_products' : 'products')
  const states = db.collection(delta ? 'english_release_delta_state' : 'product_english_state')
  const jobs = db.collection(delta ? 'english_release_delta_jobs' : 'product_english_jobs')
  const idOf = (id) => {
    if (!/^[a-f0-9]{24}$/.test(id)) throw Error('Invalid product ID')
    return toId(id)
  }
  return {
    product: (id) => products.findOne({ _id: idOf(id) }),
    state: (id) => states.findOne({ _id: id }),
    reviewHold: async (id, fingerprint) => {
      const hold = await db.collection('product_english_holds').findOne({ _id: id })
      if (hold && (hold.reason === 'identity_changed' || hold.fingerprint === fingerprint))
        return true
      return Boolean(
        await db
          .collection('local_translation_jobs')
          .findOne({ productId: idOf(id), status: 'needs_review' }, { projection: { _id: 1 } }),
      )
    },
    job: (id) => jobs.findOne({ _id: id }),
    insert: async (job) => {
      try {
        await jobs.insertOne({ ...job, _id: job.id, createdAt: new Date() })
        return true
      } catch (error) {
        if (error.code === 11000) return false
        throw error
      }
    },
    mark: async (id, values) => {
      await jobs.updateOne(
        { _id: id, status: { $ne: 'completed' } },
        { $set: { ...values, updatedAt: new Date() } },
      )
    },
    claim: async (id) =>
      (
        await jobs.updateOne(
          { _id: id, status: 'pending' },
          {
            $set: { status: 'requesting', requestedAt: new Date().toISOString() },
          },
        )
      ).matchedCount === 1,
    commit: async (job, patch, english) => {
      if (
        Object.keys(patch).some(
          (path) => !Object.hasOwn(job.before, path.replace(/\.en$/, '')) || !path.endsWith('.en'),
        )
      )
        throw Error('Unsafe text patch')
      const session = client.startSession()
      let applied = false
      try {
        await session.withTransaction(
          async () => {
            applied = false
            const existing = await products.findOne({ _id: idOf(job.productId) }, { session })
            if (!existing) return
            const routePatch = await planEnglishSlugPatch(
              products,
              existing,
              english.title,
              session,
            )
            const result = await products.updateOne(
              guardedTextFilter(
                existing._id,
                Object.hasOwn(job, 'sku') ? job.sku : existing.sku,
                job.source,
                job.before,
              ),
              {
                $set: {
                  ...(Object.keys(patch).length ? patch : { 'title.en': job.before.title }),
                  ...routePatch,
                },
              },
              { session },
            )
            if (result.matchedCount !== 1) return
            await states.updateOne(
              { _id: job.productId },
              {
                $set: {
                  ...translationState(
                    job.productId,
                    job.fingerprint,
                    job.source,
                    english,
                    existing.sku ?? null,
                  ),
                  lastJobId: job.id,
                },
                $unset: { source: '', english: '' },
              },
              { upsert: true, session },
            )
            const savedJob = await jobs.updateOne(
              { _id: job.id, status: 'response_saved' },
              {
                $set: {
                  status: 'completed',
                  completedAt: new Date(),
                },
              },
              { session },
            )
            if (savedJob.matchedCount !== 1) throw Error('Translation job changed during commit')
            applied = true
          },
          { writeConcern: { w: 'majority', j: true } },
        )
        return applied
      } finally {
        await session.endSession()
      }
    },
  }
}
