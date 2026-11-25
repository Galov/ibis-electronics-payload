// Reads production only. Restores the resulting files into a new loopback database.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { collectionDigest } from './rehearsal.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { MongoClient, BSON } = require(require.resolve('mongodb', { paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))] }))
const raw = { promoteValues:false, promoteLongs:false }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export async function backupRelease() {
  const stamp = new Date().toISOString().replaceAll(/[:.]/g,'-')
  const id = randomUUID().replaceAll('-','').slice(0,10)
  const name = `ibis_release_backup_${id}`
  const directory = path.join(root,'.local-notes/english-release-backups',`${stamp}-${id}`)
  await fs.mkdir(directory,{recursive:true,mode:0o700})
  const config = dotenv.parse(await fs.readFile(path.join(root,'.env')))
  const uri = new URL(config.DATABASE_URL || 'invalid:')
  if (uri.protocol !== 'mongodb+srv:' || uri.hostname !== 'primary-cluster.qki0ar6.mongodb.net' || uri.pathname !== '/IbisElectronicsPayload') throw Error('Unexpected backup source')
  const sourceClient = new MongoClient(config.DATABASE_URL,{serverSelectionTimeoutMS:30000,maxPoolSize:2,readPreference:'primary'})
  const targetClient = new MongoClient(`mongodb://127.0.0.1:27028/${name}?replicaSet=ibisEnLocal&directConnection=true`,{serverSelectionTimeoutMS:15000,writeConcern:{w:'majority',j:true}})
  const manifest = {format:'ibis-full-bson-backup-v1',startedAt:new Date().toISOString(),sourceDatabase:uri.pathname.slice(1),localRestoreDatabase:name,consistentSnapshot:true,collections:{},complete:false,restoreVerified:false}
  const save = () => fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600})
  await save()
  try {
    await sourceClient.connect(); await targetClient.connect()
    const source = sourceClient.db(), target = targetClient.db()
    if ((await target.listCollections().toArray()).length) throw Error('Refusing existing restore target')
    const collections = (await source.listCollections().toArray()).filter(row => !row.name.startsWith('system.')).sort((a,b)=>a.name.localeCompare(b.name))
    if (collections.some(row=>row.type !== 'collection')) throw Error('Views require a separate restore plan')
    const session = sourceClient.startSession({snapshot:true})
    try {
      for (const row of collections) {
        if (!/^[A-Za-z0-9_.-]+$/.test(row.name)) throw Error('Unexpected collection name')
        const metadata = BSON.serialize({options:row.options || {},indexes:await source.collection(row.name).listIndexes().toArray()})
        await fs.writeFile(path.join(directory,`${row.name}.metadata.bson`),metadata,{mode:0o600,flag:'wx'})
        const handle = await fs.open(path.join(directory,`${row.name}.bson`),'wx',0o600)
        let count=0, bytes=0, batch=[]; const digest=createHash('sha256')
        const flush=async()=>{if(batch.length){await handle.writeFile(Buffer.concat(batch));batch=[]}}
        try {
          for await (const doc of source.collection(row.name).find({},{...raw,session,batchSize:500,maxTimeMS:240000}).sort({_id:1})) {
            const encoded=BSON.serialize(doc);digest.update(encoded);bytes+=encoded.length;batch.push(encoded);count++
            if(batch.length===500)await flush()
          }
          await flush();await handle.sync()
        } finally {await handle.close()}
        manifest.collections[row.name]={count,bytes,sha256:digest.digest('hex'),metadataSHA256:hash(metadata)}
        await save()
        console.log(JSON.stringify({archived:row.name,documents:count}))
      }
      manifest.snapshotFinishedAt=new Date().toISOString()
    } finally {await session.endSession()}
    // Restore strictly from the saved files, never from a second production read.
    for (const [collection,expected] of Object.entries(manifest.collections)) {
      const bytes=await fs.readFile(path.join(directory,`${collection}.bson`))
      const metadataBytes=await fs.readFile(path.join(directory,`${collection}.metadata.bson`))
      if(hash(bytes)!==expected.sha256 || hash(metadataBytes)!==expected.metadataSHA256)throw Error('Backup checksum mismatch')
      const metadata=BSON.deserialize(metadataBytes)
      await target.createCollection(collection,metadata.options)
      let offset=0,batch=[],count=0
      const flush=async()=>{if(batch.length){await target.collection(collection).insertMany(batch,{ordered:true});batch=[]}}
      while(offset<bytes.length){
        if(offset+4>bytes.length)throw Error('Truncated backup')
        const size=bytes.readInt32LE(offset)
        if(size<5||offset+size>bytes.length)throw Error('Invalid BSON record')
        batch.push(BSON.deserialize(bytes.subarray(offset,offset+size),raw));offset+=size;count++
        if(batch.length===500)await flush()
      }
      await flush()
      const digest=await collectionDigest(target,collection)
      if(count!==expected.count||digest.count!==expected.count||digest.sha256!==expected.sha256)throw Error(`Restore mismatch: ${collection}`)
      const skippedTTL=[]
      for(const index of metadata.indexes){
        if(index.name==='_id_')continue
        if(index.expireAfterSeconds!==undefined){skippedTTL.push(index.name);continue}
        const {key,name,v,ns,background,...options}=index
        await target.collection(collection).createIndex(key,{...options,name})
      }
      expected.restoreVerified=true;expected.skippedTTLIndexes=skippedTTL
      await save();console.log(JSON.stringify({restored:collection,documents:count}))
    }
    manifest.complete=true;manifest.restoreVerified=true;manifest.finishedAt=new Date().toISOString();await save()
    console.log(JSON.stringify({directory,database:name,collections:Object.keys(manifest.collections).length,archiveBytes:Object.values(manifest.collections).reduce((sum,row)=>sum+row.bytes,0),verified:true}))
    return {directory,manifest}
  } finally {await sourceClient.close();await targetClient.close()}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2)throw Error('Backup accepts no arguments')
  await backupRelease()
}
