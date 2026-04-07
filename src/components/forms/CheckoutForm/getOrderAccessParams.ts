'use server'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

type Args = {
  email: string
  orderID: string
}

export async function getOrderAccessParams({ email, orderID }: Args) {
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'orders',
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      and: [
        {
          id: {
            equals: orderID,
          },
        },
        {
          customerEmail: {
            equals: email,
          },
        },
      ],
    },
  })

  const order = docs[0]

  return {
    accessToken: order?.accessToken || '',
    email,
  }
}
