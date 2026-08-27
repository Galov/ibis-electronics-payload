import type { PayloadHandler } from 'payload'

import { checkRole } from '@/access/utilities'

export const markProductReviewedHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const productID = req.routeParams?.id

  if (!productID || typeof productID !== 'string') {
    return Response.json({ message: 'Липсва ID на продукт.' }, { status: 400 })
  }

  const reviewItems = await req.payload.find({
    collection: 'product-review-items',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      product: {
        equals: productID,
      },
    },
  })

  const reviewItem = reviewItems.docs[0]
  if (!reviewItem) {
    return Response.json({ message: 'Продуктът не е част от опашката за преглед.' }, { status: 404 })
  }

  if (reviewItem.status === 'reviewed') {
    return Response.json({
      message: 'Продуктът вече е маркиран като прегледан.',
      reviewedAt: reviewItem.reviewedAt,
    })
  }

  const reviewedAt = new Date().toISOString()

  await req.payload.update({
    collection: 'product-review-items',
    data: {
      reviewedAt,
      reviewedBy: req.user.id,
      status: 'reviewed',
    },
    id: reviewItem.id,
    overrideAccess: true,
    req,
  })

  return Response.json({
    message: 'Продуктът е маркиран като прегледан.',
    reviewedAt,
  })
}
