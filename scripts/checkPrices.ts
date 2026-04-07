import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

void (async () => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 5,
    overrideAccess: true,
    pagination: false,
    select: {
      id: true,
      title: true,
      price: true,
      sourcePrice: true,
      priceInEUR: true,
      priceInUSD: true,
      priceInEUREnabled: true,
      published: true,
    },
    sort: '-updatedAt',
  })

  console.log(JSON.stringify(result.docs, null, 2))
})()
