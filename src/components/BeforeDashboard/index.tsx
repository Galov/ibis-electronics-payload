import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { ProductReviewQueueCard } from './ProductReviewQueueCard'
import './index.scss'

const visibleProductsLimit = 10

const BeforeDashboard = async () => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'product-review-items',
    depth: 0,
    limit: visibleProductsLimit,
    overrideAccess: true,
    pagination: true,
    sort: '-reviewRequiredAt',
    where: {
      status: {
        equals: 'pending',
      },
    },
    select: {
      id: true,
      productCreatedSource: true,
      product: true,
      productSku: true,
      productSlug: true,
      productTitle: true,
      reviewRequiredAt: true,
    },
  })

  const products = result.docs.flatMap((item) => {
    const rawProductID =
      typeof item.product === 'object' && item.product ? item.product.id : item.product

    if (typeof rawProductID !== 'string' && typeof rawProductID !== 'number') return []
    const productID = String(rawProductID)

    return [
      {
        id: productID,
        productCreatedSource: item.productCreatedSource,
        reviewRequiredAt: item.reviewRequiredAt,
        sku: item.productSku,
        slug: item.productSlug,
        title: item.productTitle,
      },
    ]
  })

  return (
    <ProductReviewQueueCard
      products={products}
      totalDocs={result.totalDocs}
      visibleProductsLimit={visibleProductsLimit}
    />
  )
}

export default BeforeDashboard
