import { validateBundle, englishText, englishHash, transferDecision, guardedTextFilter } from './transfer.ts'
import { translationState } from './state.ts'
import { sourceText, sourceFingerprint } from '../../scripts/localization/translationCore.ts'

// Metadata only: never changes product content, prices, stock, versions or sync outboxes.
export async function bootstrapEnglishTranslations(db, toId, bundle, reconciliation) {
  validateBundle(bundle)
  const result={baselinesAdded:0,existingBaselines:0,manualEnglish:0,missingEnglish:0,identityChanged:0,missing:0,holdsAdded:0}
  const rows=new Map(reconciliation.rows.map(row=>[row.productId,row]))
  for(let offset=0;offset<bundle.entries.length;offset+=250){
    const batch=bundle.entries.slice(offset,offset+250)
    const docs=await db.collection('products').find({_id:{$in:batch.map(e=>toId(e.productId))}},{projection:{sku:1,title:1,description:1,shortDescription:1,meta:1}}).toArray()
    const current=new Map(docs.map(doc=>[String(doc._id),doc])), writes=[]
    for(const entry of batch){
      const p=current.get(entry.productId)
      if(!p){result.missing++;continue}
      if((p.sku??'')!==entry.sku){result.identityChanged++;continue}
      // The frozen EN fingerprint, never today's English, establishes machine provenance.
      const before = englishText(p)
      const empty = Object.values(before).every(value=>!value?.trim())
      if(!empty && englishHash(before)!==englishHash(entry.english)){result.manualEnglish++;continue}
      if(empty)result.missingEnglish++
      writes.push({updateOne:{filter:{_id:entry.productId},update:{$setOnInsert:{
        ...translationState(entry.productId,entry.fingerprint,entry.source,empty?before:entry.english,p.sku??null),
        initializedAt:new Date(),bundleHash:bundle.contentHash,
      }},upsert:true}})
    }
    if(writes.length){const r=await db.collection('product_english_state').bulkWrite(writes,{ordered:true});result.baselinesAdded+=r.upsertedCount;result.existingBaselines+=r.matchedCount}
  }
  for(const entry of bundle.excluded||[]){
    const p=await db.collection('products').findOne({_id:toId(entry.productId)})
    if(!p)continue
    let fingerprint=null
    try{fingerprint=sourceFingerprint(sourceText(p))}catch{}
    const r=await db.collection('product_english_holds').updateOne({_id:entry.productId},{$setOnInsert:{
      fingerprint,reason:rows.get(entry.productId)?.status||entry.status,createdAt:new Date(),
    }},{upsert:true})
    result.holdsAdded+=r.upsertedCount
  }
  await db.collection('payload-jobs').createIndex({queue:1,processing:1,updatedAt:1},{name:'english_translation_recovery',partialFilterExpression:{taskSlug:'translateEnglishProduct'}})
  return result
}

// Restore only completely absent EN with identical BG and SKU, using the frozen
// approved response. Never replaces an existing English value or a changed source.
export async function restoreMissingReleasedEnglish(db, toId, bundle) {
  validateBundle(bundle)
  const result={restored:0,sourceChanged:0,identityChanged:0,existingEnglish:0,conflicts:0}
  for(let offset=0;offset<bundle.entries.length;offset+=250){
    const batch=bundle.entries.slice(offset,offset+250)
    const docs=await db.collection('products').find({_id:{$in:batch.map(e=>toId(e.productId))}},{projection:{sku:1,title:1,description:1,shortDescription:1,meta:1}}).toArray()
    const current=new Map(docs.map(doc=>[String(doc._id),doc])),writes=[]
    for(const entry of batch){
      const p=current.get(entry.productId)
      if(!p)continue
      if(Object.values(englishText(p)).some(value=>value?.trim())){result.existingEnglish++;continue}
      const decision=transferDecision(p,entry)
      if(decision.status==='source_changed'){result.sourceChanged++;continue}
      if(decision.status==='identity_changed'){result.identityChanged++;continue}
      if(decision.status!=='copy')continue
      writes.push({updateOne:{filter:guardedTextFilter(p._id,p.sku,decision.source,decision.before),update:{$set:decision.patch}}})
    }
    if(writes.length){const r=await db.collection('products').bulkWrite(writes,{ordered:true});result.restored+=r.matchedCount;result.conflicts+=writes.length-r.matchedCount}
  }
  return result
}
