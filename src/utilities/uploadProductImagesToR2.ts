import { execFile } from 'child_process'
import { promisify } from 'util'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

type ProductImageInput = {
  alt?: string
  legacyUrl: string
  sourceResolveAddress?: string
  sourceResolveHost?: string
  sourceHeaders?: HeadersInit
  sourceUrl?: string
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

const getContentTypeFromFilename = (filename: string) => {
  const ext = path.extname(filename).toLowerCase()

  switch (ext) {
    case '.avif':
      return 'image/avif'
    case '.gif':
      return 'image/gif'
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

const downloadImage = async ({
  filename,
  image,
}: {
  filename: string
  image: ProductImageInput
}) => {
  if (image.sourceResolveHost && image.sourceResolveAddress && image.sourceUrl) {
    const url = new URL(image.sourceUrl)
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibis-r2-'))
    const outputPath = path.join(tmpDir, filename)

    try {
      await execFileAsync('curl', [
        '--fail',
        '--silent',
        '--show-error',
        '--location',
        '--output',
        outputPath,
        '--resolve',
        `${image.sourceResolveHost}:${port}:${image.sourceResolveAddress}`,
        image.sourceUrl,
      ])

      const buffer = await fs.readFile(outputPath)

      return {
        body: buffer,
        contentType: getContentTypeFromFilename(filename),
      }
    } finally {
      await fs.rm(tmpDir, { force: true, recursive: true })
    }
  }

  const response = await fetch(image.sourceUrl || image.legacyUrl, {
    headers: image.sourceHeaders,
  })

  if (!response.ok) {
    return null
  }

  const bytes = await response.arrayBuffer()

  return {
    body: Buffer.from(bytes),
    contentType: response.headers.get('content-type') || getContentTypeFromFilename(filename),
  }
}

export const uploadProductImagesToR2 = async ({
  images,
  sku,
  sourceId,
}: {
  images: ProductImageInput[]
  sku: string
  sourceId?: number | null
}) => {
  if (!images.length || !r2Client || !bucket) {
    return images as ProductImageOutput[]
  }

  const outputs: ProductImageOutput[] = []
  const skuSegment = sanitizeSegment(sku) || (sourceId ? `product-${sourceId}` : 'product')
  const storagePrefix = sourceId ? `products/${sourceId}` : `products/by-sku/${skuSegment}`

  for (const [index, image] of images.entries()) {
    const fallbackBase = `${skuSegment}-${index + 1}`
    const filename = getFilenameFromURL(image.legacyUrl, fallbackBase)
    const ext = path.extname(filename) || '.jpg'
    const basename = path.basename(filename, ext)
    const normalizedFilename = `${sanitizeSegment(basename) || fallbackBase}${ext.toLowerCase()}`
    const storageKey = `${storagePrefix}/${index + 1}-${normalizedFilename}`

    try {
      const file = await downloadImage({
        filename: normalizedFilename,
        image,
      })

      if (!file) {
        outputs.push(image)
        continue
      }

      await r2Client.send(
        new PutObjectCommand({
          Body: file.body,
          Bucket: bucket,
          ContentType: file.contentType,
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
