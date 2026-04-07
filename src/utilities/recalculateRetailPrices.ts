import configPromise from '@payload-config'
import { getPayload } from 'payload'

const batchSize = 250

const roundPrice = (value: number) => Math.round(value * 100) / 100

export const recalculateRetailPrices = async () => {
  const payload = await getPayload({ config: configPromise })
  const pricingSettings = await payload.findGlobal({
    slug: 'pricing-settings',
    depth: 0,
    overrideAccess: true,
  })

  const markupPercent =
    typeof pricingSettings?.markupPercent === 'number' ? pricingSettings.markupPercent : 15

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
        price: true,
        sourcePrice: true,
      },
      sort: 'id',
    })

    for (const product of result.docs) {
      processed += 1

      const sourcePrice =
        typeof product.sourcePrice === 'number' && product.sourcePrice > 0
          ? product.sourcePrice
          : typeof product.price === 'number' && product.price > 0
            ? product.price
            : 0

      const nextPrice = roundPrice(sourcePrice * (1 + markupPercent / 100))

      if ((product.price || 0) === nextPrice && product.sourcePrice === sourcePrice) {
        continue
      }

      await payload.update({
        id: product.id,
        collection: 'products',
        data: {
          price: nextPrice,
          sourcePrice,
        },
        overrideAccess: true,
      })

      updated += 1
    }

    if (!result.hasNextPage) break
    page += 1
  }

  return { markupPercent, processed, updated }
}
