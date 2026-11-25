// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { withLocalDatabase } from '../../scripts/localization/englishLifecycle.mjs'
import { migrateClone, rollbackReceipt, collectionDigest } from '../../scripts/localization/rehearsal.mjs'

describe.skipIf(process.env.IBIS_RUN_LOCAL_TRANSLATION_MONGO_TESTS !== 'true')('isolated migration rehearsal', () => {
  it('migrates current/history text, preserves all other data, resumes and refuses destructive rollback', async () => {
    await withLocalDatabase(async (_old: unknown, client: any, ObjectId: any) => {
      const name = `ibis_migration_test_${randomUUID().replaceAll('-','')}`
      const db = client.db(name)
      try {
        const id = new ObjectId()
        const product = { _id: id, title: 'Нагревател 1200W', description: 'Дължина 25 cm', shortDescription: null, meta: { title: 'Нагревател', image: 'same-image' }, price: 12.3, stockQty: 4, slug: 'stable', categories: ['same'], updatedAt: new Date('2026-11-25') }
        await db.collection('products').insertOne(product)
        await db.collection('_products_versions').insertOne({ _id: new ObjectId(), parent: id, version: { ...product, _id: undefined } })
        const before = await collectionDigest(db,'products')
        const versionBefore = await collectionDigest(db,'_products_versions')
        expect((await migrateClone(db,client)).migratedDocuments).toBe(2)
        expect(await collectionDigest(db,'products',true)).toEqual(before)
        expect(await collectionDigest(db,'_products_versions',true)).toEqual(versionBefore)
        expect((await migrateClone(db,client)).migratedDocuments).toBe(0)
        const receipt = await db.collection('english_rehearsal_migration').findOne({collection:'products'})
        await rollbackReceipt(db,client,receipt)
        expect(await collectionDigest(db,'products')).toEqual(before)
        await migrateClone(db,client)
        await db.collection('products').updateOne({_id:id},{$set:{'title.en':'Heating element 1200W'}})
        const englishBefore = await collectionDigest(db,'products')
        await expect(rollbackReceipt(db,client,receipt)).rejects.toThrow('Rollback refused')
        expect(await collectionDigest(db,'products')).toEqual(englishBefore)
        await expect(rollbackReceipt(db,client,{...receipt,before:{price:1},after:{price:{bg:1}}})).rejects.toThrow('Unsafe rollback fields')
      } finally { await db.dropDatabase() }
    })
  },30000)
  it('preflights every collection before writing any product', async () => {
    await withLocalDatabase(async (_old: unknown, client: any, ObjectId: any) => {
      const name = `ibis_migration_test_${randomUUID().replaceAll('-','')}`, db=client.db(name)
      try {
        await db.collection('products').insertOne({_id:new ObjectId(),title:'Original BG',price:12})
        await db.collection('_products_versions').insertOne({_id:new ObjectId(),version:{title:123}})
        await expect(migrateClone(db,client)).rejects.toThrow('Unexpected localized value')
        expect((await db.collection('products').findOne({})).title).toBe('Original BG')
        expect(await db.collection('english_rehearsal_migration').countDocuments()).toBe(0)
      } finally { await db.dropDatabase() }
    })
  },30000)
})
