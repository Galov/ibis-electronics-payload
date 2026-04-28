import 'dotenv/config'

import { CopyObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getPayload } from 'payload'
import configPromise from '../src/payload.config'

import { PRODUCT_IMAGE_CACHE_CONTROL } from '../src/utilities/uploadProductImagesToR2'

type ProductImageLike = {
  storageKey?: null | string
}

type ProductLike = {
  id: string
  images?: null | ProductImageLike[]
  sku?: null | string
}

const bucket = process.env.R2_BUCKET
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const endpoint = process.env.R2_ENDPOINT
const region = process.env.R2_REGION || 'auto'

const batchSize = Number(process.env.R2_CACHE_BACKFILL_BATCH_SIZE || 200)
const limit = Number(process.env.R2_CACHE_BACKFILL_LIMIT || 0)
const dryRun = process.env.R2_CACHE_BACKFILL_DRY_RUN !== 'false'

const r2Client =
  bucket && accessKeyId && secretAccessKey && endpoint
    ? new S3Client({
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        endpoint,
        region,
      })
    : null

const normalizeImages = (images?: null | ProductImageLike[]) =>
  Array.isArray(images) ? images : []

const encodeCopySource = (value: string) =>
  value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

const main = async () => {
  if (!r2Client || !bucket) {
    throw new Error('R2 client is not configured. Check R2_* environment variables.')
  }

  const payload = await getPayload({ config: configPromise })

  const storageKeys = new Set<string>()
  let page = 1
  let hasNextPage = true
  let processedProducts = 0

  payload.logger.info(
    `[R2 cache backfill] scanning products batchSize=${batchSize} limit=${limit || 'all'} dryRun=${dryRun}`,
  )

  while (hasNextPage) {
    const result = await payload.find({
      collection: 'products',
      depth: 0,
      limit: batchSize,
      overrideAccess: true,
      page,
      pagination: true,
      select: {
        images: true,
        sku: true,
      },
      sort: 'id',
    })

    hasNextPage = result.hasNextPage
    page += 1

    for (const rawDoc of result.docs as ProductLike[]) {
      if (limit > 0 && processedProducts >= limit) {
        hasNextPage = false
        break
      }

      processedProducts += 1

      for (const image of normalizeImages(rawDoc.images)) {
        const key = image.storageKey?.trim()
        if (key) storageKeys.add(key)
      }
    }
  }

  const keys = Array.from(storageKeys)
  let scannedObjects = 0
  let updatedObjects = 0
  let alreadyCorrect = 0
  let failedObjects = 0

  payload.logger.info(`[R2 cache backfill] found ${keys.length} unique storage keys`)

  for (const key of keys) {
    scannedObjects += 1

    try {
      const head = await r2Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      )

      if (head.CacheControl === PRODUCT_IMAGE_CACHE_CONTROL) {
        alreadyCorrect += 1
        continue
      }

      if (dryRun) {
        payload.logger.info(
          `[R2 cache backfill][dry-run] key=${key} cacheControl=${head.CacheControl || 'none'}`,
        )
        updatedObjects += 1
        continue
      }

      await r2Client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CacheControl: PRODUCT_IMAGE_CACHE_CONTROL,
          ContentType: head.ContentType,
          CopySource: `${bucket}/${encodeCopySource(key)}`,
          Key: key,
          MetadataDirective: 'REPLACE',
        }),
      )

      updatedObjects += 1

      if (scannedObjects % 100 === 0) {
        payload.logger.info(
          `[R2 cache backfill] scanned=${scannedObjects} updated=${updatedObjects} alreadyCorrect=${alreadyCorrect} failed=${failedObjects}`,
        )
      }
    } catch (error) {
      failedObjects += 1
      payload.logger.error({
        msg: `[R2 cache backfill] failed key=${key}`,
        err: error,
      })
    }
  }

  const summary = {
    dryRun,
    scannedObjects,
    updatedObjects,
    alreadyCorrect,
    failedObjects,
    targetCacheControl: PRODUCT_IMAGE_CACHE_CONTROL,
  }

  payload.logger.info(`[R2 cache backfill] complete ${JSON.stringify(summary)}`)
  console.log(JSON.stringify(summary, null, 2))
}

try {
  const payload = await getPayload({ config: configPromise })

  try {
    await main()
  } finally {
    if (typeof payload.db.destroy === 'function') {
      await payload.db.destroy()
    }
  }

  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
