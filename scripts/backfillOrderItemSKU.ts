import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

const batchSize = 100

const backfillOrderItemSKU = async () => {
  const payload = await getPayload({ config: configPromise })

  let page = 1
  let processed = 0
  let updated = 0

  while (true) {
    const result = await payload.find({
      collection: 'orders',
      depth: 2,
      limit: batchSize,
      overrideAccess: true,
      page,
      pagination: true,
      select: {
        id: true,
        items: true,
      },
      sort: 'id',
    })

    for (const order of result.docs) {
      processed += 1

      const nextItems =
        order.items?.map((item) => {
          const product = item.product && typeof item.product === 'object' ? item.product : null
          const productSKU = product?.sku || null

          return {
            ...item,
            productSKU: productSKU || undefined,
          }
        }) || []

      const currentSignature = JSON.stringify(
        (order.items || []).map((item) => ({
          id: item.id,
          productSKU: 'productSKU' in item ? item.productSKU || null : null,
        })),
      )
      const nextSignature = JSON.stringify(
        nextItems.map((item) => ({
          id: item.id,
          productSKU: item.productSKU || null,
        })),
      )

      if (currentSignature === nextSignature) {
        continue
      }

      await payload.update({
        id: order.id,
        collection: 'orders',
        data: {
          items: nextItems,
        },
        overrideAccess: true,
      })

      updated += 1
    }

    if (!result.hasNextPage) {
      break
    }

    page += 1
  }

  console.log(JSON.stringify({ processed, updated }, null, 2))
}

void backfillOrderItemSKU()
