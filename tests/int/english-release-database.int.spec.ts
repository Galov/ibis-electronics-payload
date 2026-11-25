// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createPlan, executePlan, targetIdentity, validatePlan, serializePlan } from '../../scripts/localization/releaseDatabase.mjs'
import { withLocalDatabase } from '../../scripts/localization/englishLifecycle.mjs'
import { bundleHash } from '../../src/translations/transfer'
import { sourceFingerprint } from '../../scripts/localization/translationCore'

describe('release command guards', () => {
  it('serializes a full release file larger than a MongoDB document', () => {
    const text = 'x'.repeat(9 * 1024 * 1024)
    const bytes = serializePlan({format:'ibis-english-db-release-v1',target:'a'.repeat(64),rows:[{
      collection:'products',id:'file-test',sku:'TEST',
      before:{description:{exists:true,value:text}},after:{description:{bg:text,en:'Translated'}},
    }]})
    expect(bytes.length).toBeGreaterThan(16 * 1024 * 1024)
    expect(bytes.readInt32LE(0)).toBe(bytes.length)
  })

  it('binds a plan to the host/database without credentials and rejects non-text writes', () => {
    expect(targetIdentity('mongodb://u:p@127.0.0.1:27028/test')).toBe(targetIdentity('mongodb://other:secret@127.0.0.1:27028/test'))
    expect(targetIdentity('mongodb://127.0.0.1:27028/test')).not.toBe(targetIdentity('mongodb://127.0.0.1:27028/other'))
    expect(() => targetIdentity('mongodb://127.0.0.1')).toThrow('database name')
    expect(() => validatePlan({format:'ibis-english-db-release-v1',target:'a'.repeat(64),rows:[{collection:'products',id:'id',before:{price:{exists:true,value:1}},after:{price:{bg:1}}}]})).toThrow('Non-text')
  })
})
describe.skipIf(process.env.IBIS_RUN_LOCAL_TRANSLATION_MONGO_TESTS !== 'true')('release on isolated MongoDB', () => {
  it('resumes without repeats, preserves concurrent price changes and refuses to erase an EN edit', async () => {
    await withLocalDatabase(async (_old:unknown,client:any,ObjectId:any) => {
      const db=client.db(`ibis_release_test_${randomUUID().replaceAll('-','')}`)
      try {
        const id=new ObjectId(), versionId=new ObjectId()
        const source={title:'Помпа 30W',description:null,shortDescription:null,'meta.title':null,'meta.description':null}
        const english={...source,title:'Pump 30W'}
        const entry={productId:String(id),sku:'TEST',source,english,fingerprint:sourceFingerprint(source)}
        const bundle={format:'ibis-approved-english-v1',contentHash:bundleHash([entry]),createdAt:new Date().toISOString(),entries:[entry]}
        await db.collection('products').insertOne({_id:id,sku:'TEST',title:source.title,price:10,stockQty:3})
        await db.collection('_products_versions').insertOne({_id:versionId,parent:id,version:{title:source.title,price:9}})
        const plan=await createPlan(db,'a'.repeat(64),bundle)
        expect(plan.counts.copy).toBe(1)
        expect((await executePlan(db,plan)).changed).toBe(2)
        expect((await executePlan(db,plan)).alreadyApplied).toBe(2)
        await db.collection('products').updateOne({_id:id},{$set:{price:15,'title.en':'Manual edit'}})
        await expect(executePlan(db,plan,true)).rejects.toThrow('concurrent')
        expect((await db.collection('products').findOne({_id:id})).title.en).toBe('Manual edit')
        expect((await db.collection('_products_versions').findOne({_id:versionId})).version.title).toEqual({bg:source.title})
        await db.collection('products').updateOne({_id:id},{$set:{'title.en':'Pump 30W'}})
        await executePlan(db,plan,true)
        const product=await db.collection('products').findOne({_id:id})
        expect(product.title).toBe(source.title)
        expect(product.price).toBe(15)
        expect(product.stockQty).toBe(3)
        expect(product).not.toHaveProperty('updatedAt')
        expect((await db.collection('_products_versions').findOne({_id:versionId})).version.title).toBe(source.title)
      } finally {await db.dropDatabase()}
    })
  })
})
