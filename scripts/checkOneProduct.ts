import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

void (async () => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    sort: '-updatedAt',
  })

  console.log(JSON.stringify(result.docs[0], null, 2))
})()
