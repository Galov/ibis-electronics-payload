// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withLocalDatabase } from '../../scripts/localization/englishLifecycle.mjs'
import { backfillEnglishSlugs } from '../../scripts/localization/englishProductSlugs.mjs'
import { assignEnglishProductSlug } from '@/i18n/englishProductSlugs.mjs'

describe.skipIf(process.env.IBIS_RUN_LOCAL_TRANSLATION_MONGO_TESTS !== 'true')(
  'route-only Mongo migration',
  () => {
    it('backs up, batches, preserves all other fields, resumes and serializes concurrent title collisions', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'ibis-route-test-'))
      await withLocalDatabase(async (_: unknown, client: any, ObjectId: any) => {
        const db = client.db(`ibis_en_rehearsal_${randomUUID().replaceAll('-', '')}`)
        try {
          const docs = Array.from({ length: 601 }, (_, i) => ({
            _id: new ObjectId(),
            slug: `bg-${i}`,
            title: { bg: `БГ ${i}`, en: 'Same Pump 30W' },
            sku: `SKU${i}`,
            price: 12.34,
            stockQty: i,
          }))
          await db.collection('products').insertMany(docs)
          expect((await backfillEnglishSlugs(db)).planned).toBe(601)
          expect(
            await backfillEnglishSlugs(db, { apply: true, backupDir: directory }),
          ).toMatchObject({ applied: 601, verifiedOnlyRouteMetadataChanged: true })
          expect((await backfillEnglishSlugs(db)).planned).toBe(0)
          const saved = await db.collection('products').find({}).toArray()
          expect(new Set(saved.map((d: any) => d.englishSlug)).size).toBe(601)
          for (const d of saved) {
            delete d.englishSlug
            delete d.englishLegacySlug
          }
          expect(saved).toEqual(docs)
          const concurrent = [
            { _id: new ObjectId(), slug: 'concurrent-bg-1', title: { en: 'Concurrent pump' } },
            { _id: new ObjectId(), slug: 'concurrent-bg-2', title: { en: 'Concurrent pump' } },
          ]
          await db.collection('products').insertMany(concurrent)
          expect(
            await Promise.all(
              concurrent.map((d) =>
                assignEnglishProductSlug(db.collection('products'), client, d._id),
              ),
            ),
          ).toEqual(['assigned', 'assigned'])
          const after = await db
            .collection('products')
            .find({ _id: { $in: concurrent.map((d) => d._id) } })
            .toArray()
          expect(new Set(after.map((d: any) => d.englishSlug)).size).toBe(2)
        } finally {
          await db.dropDatabase()
        }
      })
      await rm(directory, { recursive: true, force: true })
    }, 30000)
  },
)
