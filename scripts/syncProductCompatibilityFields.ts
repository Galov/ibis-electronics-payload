import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

const batchSize = 250

const syncProducts = async () => {
  const payload = await getPayload({ config: configPromise })

  let page = 1
  let processed = 0
  let updated = 0

  while (true) {
    const result = await payload.find({
      collection: 'products',
      depth: 0,
      limit: batchSize,
      page,
      overrideAccess: true,
      pagination: true,
      select: {
        id: true,
        inventory: true,
        price: true,
        priceInEUR: true,
        priceInEUREnabled: true,
        priceInUSD: true,
        priceInUSDEnabled: true,
        stockQty: true,
      },
      sort: 'id',
    })

    for (const product of result.docs) {
      processed += 1

      const price = typeof product.price === 'number' ? product.price : 0
      const stockQty = typeof product.stockQty === 'number' ? product.stockQty : 0
      const shouldEnablePrice = price > 0
      const needsPriceEURSync = (product.priceInEUR || 0) !== price
      const needsPriceSync = (product.priceInUSD || 0) !== price
      const needsPriceEUREnabledSync = Boolean(product.priceInEUREnabled) !== shouldEnablePrice
      const needsPriceUSDEnabledSync = Boolean(product.priceInUSDEnabled) !== shouldEnablePrice
      const needsInventorySync = (product.inventory || 0) !== stockQty

      if (
        !needsPriceEURSync &&
        !needsPriceSync &&
        !needsPriceEUREnabledSync &&
        !needsPriceUSDEnabledSync &&
        !needsInventorySync
      ) {
        continue
      }

      await payload.update({
        id: product.id,
        collection: 'products',
        data: {
          inventory: stockQty,
          price,
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

void syncProducts()
