// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { withLocalDatabase } from '../../scripts/localization/englishLifecycle.mjs'
import { bootstrapEnglishTranslations, restoreMissingReleasedEnglish } from '@/translations/bootstrap.mjs'
import { mongoTranslationStore } from '@/translations/mongoStore.mjs'
import { prepareProductTranslation } from '@/translations/engine'
import { sourceText, sourceFingerprint } from '../../scripts/localization/translationCore'
import { englishText, bundleHash } from '@/translations/transfer'

describe.skipIf(process.env.IBIS_RUN_LOCAL_TRANSLATION_MONGO_TESTS !== 'true')('automatic English bootstrap', () => {
  it('seeds only proven machine EN, preserves edits and keeps changed SKU held after BG edits', async () => {
    await withLocalDatabase(async (_old: unknown, client: any, ObjectId: any) => {
      const db=client.db(`ibis_english_bootstrap_${randomUUID().replaceAll('-','')}`)
      try {
        const make=()=>({_id:new ObjectId(),sku:'AB123',title:{bg:'Помпа 30W',en:'Pump 30W'},price:12,stockQty:3})
        const p=make(),manual=make(),held=make()
        const entries=[p,manual].map(doc=>({productId:String(doc._id),sku:doc.sku,source:sourceText(doc),fingerprint:sourceFingerprint(sourceText(doc)),english:englishText(doc)}))
        const bundle={format:'ibis-approved-english-v1',createdAt:new Date().toISOString(),entries,contentHash:bundleHash(entries),excluded:[{productId:String(held._id),status:'needs_review'}]}
        manual.title.en='Hand edited'
        delete (held.title as any).en
        await db.collection('products').insertMany([p,manual,held])
        const before=await db.collection('products').find().toArray()
        const reconciliation={rows:[{productId:String(held._id),status:'identity_changed'}]}
        const result=await bootstrapEnglishTranslations(db,(id:string)=>new ObjectId(id),bundle,reconciliation)
        expect(result.baselinesAdded).toBe(1)
        expect(result.manualEnglish).toBe(1)
        expect(result.holdsAdded).toBe(1)
        expect(await db.collection('products').find().toArray()).toEqual(before)
        expect((await bootstrapEnglishTranslations(db,(id:string)=>new ObjectId(id),bundle,reconciliation)).baselinesAdded).toBe(0)
        const store=mongoTranslationStore(db,client,(id:string)=>new ObjectId(id))
        expect((await prepareProductTranslation(store,String(p._id))).status).toBe('already_ready')
        await db.collection('products').updateOne({_id:p._id},{$set:{'title.bg':'Помпа 40W'}})
        const next=await prepareProductTranslation(store,String(p._id))
        expect(next.status).toBe('pending')
        expect((await store.job(next.jobId)).fields).toEqual(['title'])
        await db.collection('products').updateOne({_id:held._id},{$set:{'title.bg':'Помпа 50W'}})
        expect((await prepareProductTranslation(store,String(held._id))).status).toBe('manual_review')
        // A vanished EN can be reused only while source and identity still match.
        await db.collection('products').updateOne({_id:p._id},{$set:{'title.bg':'Помпа 30W'},$unset:{'title.en':''}})
        expect((await restoreMissingReleasedEnglish(db,(id:string)=>new ObjectId(id),bundle)).restored).toBe(1)
        expect((await db.collection('products').findOne({_id:manual._id})).title.en).toBe('Hand edited')
        await db.collection('products').updateOne({_id:p._id},{$set:{'title.bg':'Помпа 60W'},$unset:{'title.en':''}})
        expect((await restoreMissingReleasedEnglish(db,(id:string)=>new ObjectId(id),bundle)).sourceChanged).toBe(1)
      } finally {await db.dropDatabase()}
    })
  })
})
