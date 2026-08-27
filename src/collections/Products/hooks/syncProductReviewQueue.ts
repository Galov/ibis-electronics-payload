import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { checkRole } from '@/access/utilities'

const getSource = (value: unknown): 'manual' | 'nik' | 'other' => {
  if (value === 'nik' || value === 'other') return value
  return 'manual'
}

export const syncProductReviewQueueAfterChange: CollectionAfterChangeHook = async ({
  context,
  doc,
  operation,
  req,
}) => {
  if (context.skipProductReviewQueue) return doc

  if (operation === 'create') {
    await req.payload.create({
      collection: 'product-review-items',
      data: {
        product: doc.id,
        productCreatedSource: getSource(doc.productCreatedSource),
        productSku: typeof doc.sku === 'string' ? doc.sku : undefined,
        productSlug: typeof doc.slug === 'string' ? doc.slug : undefined,
        productTitle:
          typeof doc.title === 'string' && doc.title.trim()
            ? doc.title
            : typeof doc.sku === 'string' && doc.sku.trim()
              ? doc.sku
              : String(doc.id),
        reviewRequiredAt: new Date().toISOString(),
        status: 'pending',
      },
      overrideAccess: true,
      req,
    })

    return doc
  }

  if (!req.user || !checkRole(['admin'], req.user)) return doc

  const pendingItems = await req.payload.find({
    collection: 'product-review-items',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [
        {
          product: {
            equals: doc.id,
          },
        },
        {
          status: {
            equals: 'pending',
          },
        },
      ],
    },
  })

  const pendingItem = pendingItems.docs[0]
  if (!pendingItem) return doc

  await req.payload.update({
    collection: 'product-review-items',
    data: {
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.id,
      status: 'reviewed',
    },
    id: pendingItem.id,
    overrideAccess: true,
    req,
  })

  return doc
}

export const removeProductReviewQueueItemAfterDelete: CollectionAfterDeleteHook = async ({
  doc,
  req,
}) => {
  await req.payload.delete({
    collection: 'product-review-items',
    overrideAccess: true,
    req,
    where: {
      product: {
        equals: doc.id,
      },
    },
  })

  return doc
}
