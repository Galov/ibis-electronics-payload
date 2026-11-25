import { englishHash } from '@/translations/transfer'
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  withLocalDatabase,
  applyApprovedLocally,
} from '../../scripts/localization/englishLifecycle.mjs'
import { mongoTranslationStore } from '@/translations/mongoStore.mjs'
import { sourceText, sourceFingerprint } from '../../scripts/localization/translationCore'
import { englishText, bundleHash } from '@/translations/transfer'
import { prepareProductTranslation, runProductTranslation } from '@/translations/engine'

// Explicitly opt in. Uses only the existing loopback Mongo and drops only its own temporary DB.
describe.skipIf(process.env.IBIS_RUN_LOCAL_TRANSLATION_MONGO_TESTS !== 'true')(
  'local Mongo English transfer rehearsal',
  () => {
    it('transfers EN only, resumes, preserves changed BG/manual EN, and atomically records a new translation', async () => {
      await withLocalDatabase(async (_original: unknown, client: any, ObjectId: any) => {
        const name = `ibis_en_rehearsal_${randomUUID().replaceAll('-', '')}`
        const db = client.db(name)
        try {
          const make = () => ({
            _id: new ObjectId(),
            sku: 'AB123',
            price: 23.45,
            stockQty: 7,
            slug: 'stable',
            images: ['image'],
            title: { bg: 'Амортисьор 120N' },
            description: { bg: null },
            shortDescription: { bg: null },
            meta: { title: { bg: null }, description: { bg: null }, image: 'same' },
            updatedAt: new Date('2026-10-24'),
            sync: { revision: 10 },
          })
          const first = make(),
            changed = make(),
            manual = make()
          const entries = [first, changed, manual].map((p) => ({
            productId: String(p._id),
            sku: p.sku,
            source: sourceText(p),
            fingerprint: sourceFingerprint(sourceText(p)),
            english: { ...englishText(p), title: 'Shock absorber 120N' },
          }))
          const bundle = {
            format: 'ibis-approved-english-v1',
            createdAt: '2026-11-25',
            entries,
            contentHash: bundleHash(entries),
          }
          await db.collection('products').insertMany([first, changed, manual])
          await db
            .collection('products')
            .updateOne({ _id: changed._id }, { $set: { 'title.bg': 'Амортисьор 140N' } })
          await db
            .collection('products')
            .updateOne({ _id: manual._id }, { $set: { 'title.en': 'Manual approved edit' } })
          const result = await applyApprovedLocally(db, client, ObjectId, bundle)
          expect(result).toEqual({ copy: 1, source_changed: 1, english_conflict: 1 })
          const saved = await db.collection('products').findOne({ _id: first._id })
          expect(saved.title.en).toBe('Shock absorber 120N')
          delete saved.title.en
          expect(saved).toEqual(first)
          expect((await applyApprovedLocally(db, client, ObjectId, bundle)).already_present).toBe(1)
          expect(await db.collection('product_english_state').countDocuments()).toBe(1)
          const fresh = make()
          await db.collection('products').insertOne(fresh)
          const store = mongoTranslationStore(db, client, (id: string) => new ObjectId(id))
          const job = await prepareProductTranslation(store, String(fresh._id))
          const provider = vi.fn(async () => ({ title: 'Shock absorber 120N' }))
          expect(await runProductTranslation(store, job.jobId!, provider)).toBe('completed')
          expect(await runProductTranslation(store, job.jobId!, provider)).toBe('completed')
          expect(provider).toHaveBeenCalledTimes(1)
          expect((await store.job(job.jobId!))!.status).toBe('completed')
          const translated = await db.collection('products').findOne({ _id: fresh._id })
          expect(translated.englishSlug).toBe('shock-absorber-120n')
          expect(translated.slug).toBe(fresh.slug)
          expect(translated.price).toBe(fresh.price)
          expect(translated.stockQty).toBe(fresh.stockQty)
          expect((await store.state(String(fresh._id)))!.englishHash).toBe(
            englishHash({ ...englishText(fresh), title: 'Shock absorber 120N' }),
          )
        } finally {
          if (!name.startsWith('ibis_en_rehearsal_')) throw Error('Invalid test DB')
          await db.dropDatabase()
        }
      })
    }, 30000)
  },
)
