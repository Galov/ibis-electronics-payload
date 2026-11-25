// Creates labelled local test data only. Saves original settings so they can be restored.
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { localRehearsal } from '../rehearsal.mjs'
const require=createRequire(import.meta.url)
const {BSON}=require(require.resolve('mongodb',{paths:[path.dirname(require.resolve('@payloadcms/db-mongodb'))]}))
const dir='.local-notes/english-release-rehearsal'
await localRehearsal(async db=>{
 if(await db.collection('products').findOne({sku:'LOCAL-EN-REHEARSAL'}))throw Error('Test fixture already exists')
 const sample=await db.collection('products').findOne({published:true,stockQty:{$gt:0},'images.0':{$exists:true}})
 if(!sample?.images?.length)throw Error('No image fixture available')
 const settings=await db.collection('globals').findOne({globalType:'order-settings'})
 if(!settings)throw Error('No order settings')
 await fs.writeFile(`${dir}/test-settings-before.bson`,BSON.serialize(settings),{mode:0o600,flag:'wx'})
 const id=new BSON.ObjectId(),now=new Date()
 await db.collection('products').insertOne({_id:id,sku:'LOCAL-EN-REHEARSAL',slug:'local-english-rehearsal-product',
  title:{bg:'ЛОКАЛЕН ТЕСТ — без реална продажба',en:'LOCAL TEST — no real sale'},
  description:{bg:'Само за локална репетиция.',en:'For local rehearsal only.'},shortDescription:{bg:null},
  meta:{title:{bg:'Локален тест',en:'Local test'},description:{bg:null}},
  price:10,priceInEUR:10,priceInEUREnabled:true,sourcePrice:10,stockQty:100,inventory:100,
  images:[sample.images[0]],published:true,_status:'published',enableVariants:false,createdAt:now,updatedAt:now,
 })
 await db.collection('globals').updateOne({_id:settings._id},{$set:{revolutPayEnabled:true,notificationRecipients:[{email:'admin@rehearsal.invalid'}]}})
 await fs.writeFile(`${dir}/test-fixtures.json`,JSON.stringify({productId:String(id),slug:'local-english-rehearsal-product',sku:'LOCAL-EN-REHEARSAL',price:10,localOnly:true}),{mode:0o600})
 console.log(JSON.stringify({localTestProductCreated:true,simulatedPaymentEnabled:true}))
})
