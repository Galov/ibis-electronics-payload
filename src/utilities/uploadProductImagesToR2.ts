import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import path from 'path'

type ProductImageInput = {
  alt?: string
  legacyUrl: string
}

type ProductImageOutput = {
  alt?: string
  legacyUrl: string
  storageKey?: string
}

const bucket = process.env.R2_BUCKET
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const endpoint = process.env.R2_ENDPOINT
const region = process.env.R2_REGION || 'auto'

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

const sanitizeSegment = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const getFilenameFromURL = (url: string, fallbackBase: string) => {
  try {
    const pathname = new URL(url).pathname
    const rawFilename = path.basename(pathname)

    if (rawFilename && rawFilename !== '/' && rawFilename !== '.') {
      return rawFilename
    }
  } catch {
    // ignore invalid URL parsing here and fall back below
  }

  return `${fallbackBase}.jpg`
}

export const uploadProductImagesToR2 = async ({
  images,
  sku,
  sourceId,
}: {
  images: ProductImageInput[]
  sku: string
  sourceId: number
}) => {
  if (!images.length || !r2Client || !bucket) {
    return images as ProductImageOutput[]
  }

  const outputs: ProductImageOutput[] = []
  const skuSegment = sanitizeSegment(sku) || `product-${sourceId}`

  for (const [index, image] of images.entries()) {
    const fallbackBase = `${skuSegment}-${index + 1}`
    const filename = getFilenameFromURL(image.legacyUrl, fallbackBase)
    const ext = path.extname(filename) || '.jpg'
    const basename = path.basename(filename, ext)
    const normalizedFilename = `${sanitizeSegment(basename) || fallbackBase}${ext.toLowerCase()}`
    const storageKey = `products/${sourceId}/${index + 1}-${normalizedFilename}`

    try {
      const response = await fetch(image.legacyUrl)

      if (!response.ok) {
        outputs.push(image)
        continue
      }

      const bytes = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'application/octet-stream'

      await r2Client.send(
        new PutObjectCommand({
          Body: Buffer.from(bytes),
          Bucket: bucket,
          ContentType: contentType,
          Key: storageKey,
        }),
      )

      outputs.push({
        ...image,
        storageKey,
      })
    } catch {
      outputs.push(image)
    }
  }

  return outputs
}
