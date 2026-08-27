import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

const apply = process.argv.includes('--apply')
const initialQueueSize = 12

type LegacyProduct = {
  _id: { toString(): string }
  createdAt?: Date
  productCreatedSource?: 'manual' | 'nik' | 'other'
  reviewedAt?: Date
  reviewedBy?: { toString(): string } | string
  reviewRequiredAt?: Date
  sku?: string
  slug?: string
  title?: string
}

type LegacyProductVersion = {
  parent: { toString(): string }
  version?: {
    reviewedAt?: Date
    reviewedBy?: { toString(): string } | string
  }
}

const asISOString = (value?: Date) => value?.toISOString()

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const database = payload.db.connection?.db

  if (!database) throw new Error('MongoDB connection is not available.')

  const products = (await database
    .collection('products')
    .find({
      sku: { $exists: true, $nin: ['', null] },
      title: { $exists: true, $nin: ['', null] },
    })
    .sort({ createdAt: -1 })
    .limit(initialQueueSize)
    .toArray()) as unknown as LegacyProduct[]

  const productIDs = products.map((product) => product._id)
  const latestVersions = (await database
    .collection('_products_versions')
    .find({ latest: true, parent: { $in: productIDs } })
    .toArray()) as unknown as LegacyProductVersion[]
  const latestVersionByProductID = new Map(
    latestVersions.map((item) => [item.parent.toString(), item.version]),
  )

  const candidates = products.map((product) => {
    const productID = product._id.toString()
    const latestVersion = latestVersionByProductID.get(productID)
    const reviewedAt = latestVersion?.reviewedAt || product.reviewedAt
    const reviewedBy = latestVersion?.reviewedBy || product.reviewedBy

    return {
      product: productID,
      productCreatedSource: product.productCreatedSource || 'manual',
      productSku: product.sku,
      productSlug: product.slug,
      productTitle: product.title || product.sku || productID,
      reviewRequiredAt:
        asISOString(product.reviewRequiredAt) || asISOString(product.createdAt) || new Date().toISOString(),
      reviewedAt: asISOString(reviewedAt),
      reviewedBy: reviewedBy ? reviewedBy.toString() : undefined,
      status: reviewedAt ? ('reviewed' as const) : ('pending' as const),
    }
  })

  if (apply) {
    for (const candidate of candidates) {
      const existing = await payload.find({
        collection: 'product-review-items',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        pagination: false,
        where: {
          product: {
            equals: candidate.product,
          },
        },
      })

      const data = {
        ...candidate,
        reviewedBy: candidate.reviewedBy || null,
      }

      if (existing.docs[0]) {
        await payload.update({
          collection: 'product-review-items',
          data,
          id: existing.docs[0].id,
          overrideAccess: true,
        })
      } else {
        await payload.create({
          collection: 'product-review-items',
          data,
          overrideAccess: true,
        })
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        candidates: candidates.map((candidate) => ({
          product: candidate.product,
          sku: candidate.productSku,
          status: candidate.status,
          title: candidate.productTitle,
        })),
        counts: {
          pending: candidates.filter((candidate) => candidate.status === 'pending').length,
          reviewed: candidates.filter((candidate) => candidate.status === 'reviewed').length,
          total: candidates.length,
        },
        mode: apply ? 'apply' : 'dry-run',
      },
      null,
      2,
    ),
  )

  process.exit(0)
}

void run()
