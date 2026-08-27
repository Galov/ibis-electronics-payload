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

  const product = await req.payload.findByID({
    collection: 'products',
    depth: 0,
    id: productID,
    overrideAccess: true,
    req,
    select: {
      reviewRequiredAt: true,
      reviewedAt: true,
      title: true,
    },
  })

  if (!product?.reviewRequiredAt) {
    return Response.json({ message: 'Този продукт не е в списъка за преглед.' }, { status: 400 })
  }

  if (product.reviewedAt) {
    return Response.json({
      message: 'Продуктът вече е маркиран като прегледан.',
      reviewedAt: product.reviewedAt,
    })
  }

  const reviewedAt = new Date().toISOString()

  await req.payload.update({
    collection: 'products',
    context: {
      skipProductReviewState: true,
    },
    data: {
      reviewedAt,
      reviewedBy: String(req.user.id),
    },
    id: productID,
    overrideAccess: true,
    req,
  })

  return Response.json({
    message: 'Продуктът е маркиран като прегледан.',
    reviewedAt,
  })
}
