import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { ProductReviewQueueCard } from './ProductReviewQueueCard'
import './index.scss'

const visibleProductsLimit = 10

const BeforeDashboard = async () => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'products',
    depth: 0,
    limit: visibleProductsLimit,
    overrideAccess: true,
    pagination: true,
    sort: '-createdAt',
    where: {
      and: [
        {
          needsReview: {
            equals: true,
          },
        },
        {
          or: [
            {
              sku: {
                exists: true,
              },
            },
            {
              title: {
                exists: true,
              },
            },
          ],
        },
      ],
    },
    select: {
      createdAt: true,
      id: true,
      productCreatedSource: true,
      reviewRequiredAt: true,
      sku: true,
      slug: true,
      title: true,
    },
  })

  return (
    <ProductReviewQueueCard
      products={result.docs}
      totalDocs={result.totalDocs}
      visibleProductsLimit={visibleProductsLimit}
    />
  )
}

export default BeforeDashboard
