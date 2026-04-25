import 'dotenv/config'

import configPromise from '@payload-config'
import fs from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'

import { uploadProductImagesToR2 } from '@/utilities/uploadProductImagesToR2'

type ProductImageLike = {
  alt?: null | string
  id?: null | string
  image?: null | string | { id?: string | null }
  legacyUrl?: null | string
  storageKey?: null | string
}

type ProductLike = {
  id: string
  images?: null | ProductImageLike[]
  imagesMigrated?: boolean | null
  sku?: null | string
  sourceId?: number | null
  title?: null | string
}

type MigrationFailure = {
  productId: string
  productTitle: string
  sku: string
  imageIndex: number
  legacyUrl: string
  rewrittenUrl: string
  reason: string
}

const batchSize = Number(process.env.R2_MIGRATION_BATCH_SIZE || 100)
const limit = Number(process.env.R2_MIGRATION_LIMIT || 0)
const oldHost = process.env.R2_MIGRATION_OLD_HOST || 'old.ibis-electronics.com'
const sourceHost = process.env.R2_MIGRATION_SOURCE_HOST || 'ibis-electronics.com'
const sourceIp = process.env.R2_MIGRATION_SOURCE_IP || ''
const dryRun = process.env.R2_MIGRATION_DRY_RUN === 'true'
const reportDir = process.env.R2_MIGRATION_REPORT_DIR || '/tmp'

const rewriteLegacyUrl = (legacyUrl: string) => {
  try {
    const url = new URL(legacyUrl)

    if (sourceIp && (url.hostname === sourceHost || url.hostname === `www.${sourceHost}`)) {
      return legacyUrl
    }

    if (url.hostname === 'ibis-electronics.com' || url.hostname === 'www.ibis-electronics.com') {
      url.hostname = oldHost
      return url.toString()
    }

    return legacyUrl
  } catch {
    return legacyUrl
  }
}

const normalizeProductImages = (images?: null | ProductImageLike[]) => Array.isArray(images) ? images : []

const hasUploadedMedia = (image?: ProductImageLike | null) => {
  if (!image?.image) return false
  if (typeof image.image === 'string') return Boolean(image.image)

  return Boolean(image.image.id)
}

const needsMigration = (image?: ProductImageLike | null) =>
  Boolean(image?.legacyUrl && !image?.storageKey && !hasUploadedMedia(image))

const buildReportPath = () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(reportDir, `ibis-r2-migration-report-${stamp}.json`)
}

const main = async () => {
  const payload = await getPayload({ config: configPromise })
  const failures: MigrationFailure[] = []

  let processedProducts = 0
  let migratedProducts = 0
  let skippedProducts = 0
  let migratedImages = 0
  let page = 1
  let hasNextPage = true

  payload.logger.info(
    `[R2 migration] starting oldHost=${oldHost} batchSize=${batchSize} limit=${limit || 'all'} dryRun=${dryRun}`,
  )

  while (hasNextPage) {
    const result = await payload.find({
      collection: 'products',
      depth: 0,
      limit: batchSize,
      overrideAccess: true,
      page,
      sort: 'id',
      select: {
        id: true,
        title: true,
        sku: true,
        sourceId: true,
        images: true,
        imagesMigrated: true,
      },
    })

    hasNextPage = result.hasNextPage
    page += 1

    for (const rawDoc of result.docs as ProductLike[]) {
      if (limit > 0 && processedProducts >= limit) {
        hasNextPage = false
        break
      }

      processedProducts += 1

      const images = normalizeProductImages(rawDoc.images)
      const pendingImages = images
        .map((image, index) => ({ image, index }))
        .filter(({ image }) => needsMigration(image))

      if (!pendingImages.length) {
        skippedProducts += 1

        if (processedProducts % 100 === 0) {
          payload.logger.info(
            `[R2 migration] processed=${processedProducts} migratedProducts=${migratedProducts} skippedProducts=${skippedProducts} migratedImages=${migratedImages}`,
          )
        }

        continue
      }

      const sku = rawDoc.sku?.trim() || rawDoc.id
      const title = rawDoc.title?.trim() || rawDoc.id

      const uploadInputs = pendingImages.map(({ image }) => ({
        alt: image.alt || undefined,
        legacyUrl: image.legacyUrl!.trim(),
        sourceResolveAddress: sourceIp || undefined,
        sourceResolveHost: sourceIp ? sourceHost : undefined,
        sourceUrl: rewriteLegacyUrl(image.legacyUrl!.trim()),
      }))

      if (dryRun) {
        payload.logger.info(
          `[R2 migration][dry-run] product=${sku} images=${uploadInputs.length} source=${uploadInputs[0]?.sourceUrl || ''}`,
        )
        migratedProducts += 1
        migratedImages += uploadInputs.length
        continue
      }

      const uploadedImages = await uploadProductImagesToR2({
        images: uploadInputs,
        sku,
        sourceId: rawDoc.sourceId,
      })

      const nextImages = [...images]
      let productMigratedImages = 0

      uploadedImages.forEach((uploadedImage, uploadIndex) => {
        const target = pendingImages[uploadIndex]

        if (!target) return

        if (!uploadedImage.storageKey) {
          failures.push({
            productId: rawDoc.id,
            productTitle: title,
            sku,
            imageIndex: target.index,
            legacyUrl: uploadedImage.legacyUrl,
            rewrittenUrl: uploadInputs[uploadIndex]?.sourceUrl || uploadedImage.legacyUrl,
            reason: 'upload_failed_or_source_unreachable',
          })
          return
        }

        productMigratedImages += 1
        nextImages[target.index] = {
          ...nextImages[target.index],
          storageKey: uploadedImage.storageKey,
        }
      })

      const allImagesReady = nextImages.every((image) => {
        if (hasUploadedMedia(image)) return true
        if (!image.legacyUrl) return true
        return Boolean(image.storageKey)
      })

      await payload.update({
        collection: 'products',
        id: rawDoc.id,
        data: {
          images: nextImages as any,
          imagesMigrated: allImagesReady,
        },
        depth: 0,
        overrideAccess: true,
      })

      migratedProducts += 1
      migratedImages += productMigratedImages

      payload.logger.info(
        `[R2 migration] product=${sku} migrated=${productMigratedImages}/${pendingImages.length} totalProcessed=${processedProducts}`,
      )
    }
  }

  let reportPath: null | string = null

  if (failures.length > 0) {
    reportPath = buildReportPath()
    await fs.writeFile(reportPath, JSON.stringify({ failures }, null, 2), 'utf8')
  }

  const summary = {
    dryRun,
    oldHost,
    processedProducts,
    migratedProducts,
    skippedProducts,
    migratedImages,
    failedImages: failures.length,
    reportPath,
  }

  payload.logger.info(`[R2 migration] complete ${JSON.stringify(summary)}`)
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
