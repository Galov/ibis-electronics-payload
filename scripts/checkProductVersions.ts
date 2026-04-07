import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const parent = '69b448c2c23d34935c3c0dfb'

void (async () => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: '_products_versions' as never,
    depth: 0,
    limit: 5,
    overrideAccess: true,
    pagination: false,
    sort: '-updatedAt',
    where: {
      parent: {
        equals: parent,
      },
    },
  } as never)

  console.log(JSON.stringify(result.docs, null, 2))
})()
