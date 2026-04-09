import type { Payload, PayloadHandler } from 'payload'
import { uploadProductImagesToR2 } from '@/utilities/uploadProductImagesToR2'

type NikSyncEvent =
  | 'product.created'
  | 'product.price_stock_updated'
  | 'product.deactivated'
  | 'product.deleted'

type NikBrandPayload = {
  sourceTermId?: unknown
}

type NikCategoryPayload = {
  sourceTermId?: unknown
}

type NikImagePayload = {
  legacyUrl?: unknown
  alt?: unknown
}

type NikSyncItem = {
  sourceId?: unknown
  sku?: unknown
  data?: {
    title?: unknown
    description?: unknown
    shortDescription?: unknown
    originalSku?: unknown
    manufacturerCode?: unknown
    sourcePrice?: unknown
    stockQty?: unknown
    published?: unknown
    legacyProductUrl?: unknown
    legacyModifiedAt?: unknown
    brand?: NikBrandPayload | null
    categories?: unknown
    images?: unknown
  }
}

type NikSyncRequestBody =
  | NikSyncItem[]
  | {
      event?: unknown
      items?: unknown
    }

type SyncResultItem = {
  sku: string | null
  sourceId: number | null
  status: 'created' | 'updated' | 'deactivated' | 'deleted' | 'not_found' | 'invalid' | 'exists'
  message?: string
  sourcePrice?: number
  price?: number
}

type NormalizedImage = {
  legacyUrl: string
  alt?: string
}

const roundPrice = (value: number) => Math.round(value * 100) / 100

const buildProductSlug = ({
  title,
  sku,
  sourceId,
}: {
  title: string
  sku: string
  sourceId?: number | null
}) => {
  const suffix = sourceId ? `${sourceId}` : 'nik'
  const base = `${title}-${sku}-${suffix}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || (sourceId ? `product-${sourceId}` : `product-${sku.toLowerCase()}`)
}

const getPositiveNumber = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

const getNonNegativeNumber = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }

  return value
}

const getString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const getBoolean = (value: unknown) => (typeof value === 'boolean' ? value : null)

const getInteger = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null
  }

  return value
}

const getStockStatus = (stockQty: number) => (stockQty > 0 ? 'instock' : 'outofstock')

const parseRequest = (body: NikSyncRequestBody): { event: NikSyncEvent; items: NikSyncItem[] } | null => {
  if (Array.isArray(body)) {
    return {
      event: 'product.price_stock_updated',
      items: body,
    }
  }

  if (
    body &&
    typeof body === 'object' &&
    typeof body.event === 'string' &&
    Array.isArray(body.items) &&
    [
      'product.created',
      'product.price_stock_updated',
      'product.deactivated',
      'product.deleted',
    ].includes(body.event)
  ) {
    return {
      event: body.event as NikSyncEvent,
      items: body.items as NikSyncItem[],
    }
  }

  return null
}

const findProduct = async ({
  payload,
  sourceId,
  sku,
}: {
  payload: Payload
  sourceId: number | null
  sku: string | null
}) => {
  if (sourceId !== null) {
    const bySourceId = await payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      select: {
        id: true,
        sku: true,
        sourceId: true,
      },
      where: {
        sourceId: {
          equals: sourceId,
        },
      },
    })

    if (bySourceId.docs[0]) {
      return bySourceId.docs[0]
    }
  }

  if (sku) {
    const bySku = await payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      select: {
        id: true,
        sku: true,
        sourceId: true,
      },
      where: {
        sku: {
          equals: sku,
        },
      },
    })

    return bySku.docs[0] || null
  }

  return null
}

const resolveBrandId = async ({
  payload,
  brand,
}: {
  payload: Payload
  brand: NikBrandPayload | null | undefined
}) => {
  const sourceTermId = getInteger(brand?.sourceTermId)

  if (sourceTermId === null) {
    return null
  }

  const result = await payload.find({
    collection: 'brands',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      sourceTermId: {
        equals: sourceTermId,
      },
    },
  })

  return result.docs[0]?.id ?? null
}

const resolveCategoryIds = async ({
  payload,
  categories,
}: {
  payload: Payload
  categories: unknown
}) => {
  if (!Array.isArray(categories) || categories.length === 0) {
    return []
  }

  const ids = categories
    .map((category) => getInteger((category as NikCategoryPayload | null | undefined)?.sourceTermId))
    .filter((value): value is number => value !== null)

  if (!ids.length) {
    return []
  }

  const result = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: ids.length,
    overrideAccess: true,
    pagination: false,
    where: {
      sourceTermId: {
        in: ids,
      },
    },
  })

  return result.docs.map((doc) => doc.id)
}

const normalizeImages = (images: unknown) => {
  if (!Array.isArray(images)) {
    return [] as NormalizedImage[]
  }

  const normalized: NormalizedImage[] = []

  for (const image of images) {
    const legacyUrl = getString((image as NikImagePayload | null | undefined)?.legacyUrl)

    if (!legacyUrl) {
      continue
    }

    normalized.push({
      legacyUrl,
      alt: getString((image as NikImagePayload | null | undefined)?.alt) ?? undefined,
    })
  }

  return normalized
}

const updatePriceAndStock = async ({
  images,
  published,
  payload,
  productId,
  sourcePrice,
  stockQty,
  markupPercent,
}: {
  images?: NormalizedImage[]
  published?: boolean | null
  payload: Payload
  productId: number | string
  sourcePrice: number
  stockQty: number | null
  markupPercent: number
}) => {
  const price = roundPrice(sourcePrice * (1 + markupPercent / 100))

  await payload.update({
    collection: 'products',
    id: productId,
    data: {
      price,
      sourcePrice,
      ...(stockQty !== null
        ? {
            stockQty,
            stockStatus: getStockStatus(stockQty),
          }
        : {}),
      ...(images ? { images } : {}),
      ...(typeof published === 'boolean' ? { published } : {}),
    },
    overrideAccess: true,
  })

  return price
}

export const nikPriceSyncHandler: PayloadHandler = async (req) => {
  const configuredSecret = process.env.NIK_SYNC_WEBHOOK_SECRET

  if (!configuredSecret) {
    return Response.json(
      { message: 'NIK_SYNC_WEBHOOK_SECRET is not configured.' },
      { status: 500 },
    )
  }

  const providedSecret = req.headers.get('x-webhook-secret')

  if (providedSecret !== configuredSecret) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  if (typeof req.json !== 'function') {
    return Response.json({ message: 'Request body is not available.' }, { status: 400 })
  }

  let parsedBody: NikSyncRequestBody

  try {
    parsedBody = (await req.json()) as NikSyncRequestBody
  } catch {
    return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsedRequest = parseRequest(parsedBody)

  if (!parsedRequest) {
    return Response.json(
      {
        message:
          'Body must be either an array of items or an object with event and items.',
      },
      { status: 400 },
    )
  }

  const pricingSettings = await req.payload.findGlobal({
    slug: 'pricing-settings',
    depth: 0,
    overrideAccess: true,
  })

  const markupPercent =
    typeof pricingSettings?.markupPercent === 'number' ? pricingSettings.markupPercent : 15

  const result = {
    event: parsedRequest.event,
    markupPercent,
    processed: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
    deleted: 0,
    notFound: 0,
    invalid: 0,
    exists: 0,
    items: [] as SyncResultItem[],
  }

  for (const item of parsedRequest.items) {
    result.processed += 1

    const sourceId = getInteger(item?.sourceId)
    const sku = getString(item?.sku)

    if (!sourceId && !sku) {
      result.invalid += 1
      result.items.push({
        sku: sku ?? null,
        sourceId,
        status: 'invalid',
        message: 'Each item must include sourceId or sku.',
      })
      continue
    }

    const product = await findProduct({
      payload: req.payload,
      sourceId,
      sku,
    })

    if (parsedRequest.event === 'product.created') {
      if (product) {
        result.exists += 1
        result.items.push({
          sku: sku ?? null,
          sourceId,
          status: 'exists',
          message: 'Product already exists in Ibis.',
        })
        continue
      }

      const title = getString(item?.data?.title)
      const sourcePrice = getPositiveNumber(item?.data?.sourcePrice)
      const stockQty = getNonNegativeNumber(item?.data?.stockQty)

      if (!title || !sku || sourcePrice === null || stockQty === null) {
        result.invalid += 1
        result.items.push({
          sku: sku ?? null,
          sourceId,
          status: 'invalid',
          message:
            'product.created requires sku, data.title, data.sourcePrice and data.stockQty.',
        })
        continue
      }

      const price = roundPrice(sourcePrice * (1 + markupPercent / 100))
      const brandId = await resolveBrandId({
        payload: req.payload,
        brand: item?.data?.brand,
      })
      const categoryIds = await resolveCategoryIds({
        payload: req.payload,
        categories: item?.data?.categories,
      })
      const images = await uploadProductImagesToR2({
        images: normalizeImages(item?.data?.images),
        sku,
        sourceId,
      })
      const published = getBoolean(item?.data?.published)

      await req.payload.create({
        collection: 'products',
        data: {
          ...(sourceId !== null ? { sourceId } : {}),
          sku,
          slug: buildProductSlug({ title, sku, sourceId }),
          title,
          price,
          sourcePrice,
          stockQty,
          stockStatus: getStockStatus(stockQty),
          published: published ?? true,
          ...(getString(item?.data?.description)
            ? { description: getString(item?.data?.description) }
            : {}),
          ...(getString(item?.data?.shortDescription)
            ? { shortDescription: getString(item?.data?.shortDescription) }
            : {}),
          ...(getString(item?.data?.originalSku)
            ? { originalSku: getString(item?.data?.originalSku) }
            : {}),
          ...(getString(item?.data?.manufacturerCode)
            ? { manufacturerCode: getString(item?.data?.manufacturerCode) }
            : {}),
          ...(getString(item?.data?.legacyProductUrl)
            ? { legacyProductUrl: getString(item?.data?.legacyProductUrl) }
            : {}),
          ...(getString(item?.data?.legacyModifiedAt)
            ? { legacyModifiedAt: getString(item?.data?.legacyModifiedAt) }
            : {}),
          ...(brandId ? { brand: brandId } : {}),
          ...(categoryIds.length ? { categories: categoryIds } : {}),
          ...(images.length ? { images } : {}),
        },
        draft: false,
        overrideAccess: true,
      })

      result.created += 1
      result.items.push({
        sku,
        sourceId,
        status: 'created',
        sourcePrice,
        price,
      })
      continue
    }

    if (!product) {
      result.notFound += 1
      result.items.push({
        sku: sku ?? null,
        sourceId,
        status: 'not_found',
        message: 'No matching product was found in Ibis.',
      })
      continue
    }

    if (parsedRequest.event === 'product.price_stock_updated') {
      const sourcePrice = getPositiveNumber(item?.data?.sourcePrice)
      const stockQty = getNonNegativeNumber(item?.data?.stockQty)
      const shouldUpdateImages = Array.isArray(item?.data?.images)
      const published = getBoolean(item?.data?.published)

      if (sourcePrice === null) {
        result.invalid += 1
        result.items.push({
          sku: sku ?? null,
          sourceId,
          status: 'invalid',
          message: 'product.price_stock_updated requires data.sourcePrice.',
        })
        continue
      }

      const images = shouldUpdateImages
        ? await uploadProductImagesToR2({
            images: normalizeImages(item?.data?.images),
            sku: sku ?? product.sku ?? `product-${sourceId ?? product.sourceId ?? 'unknown'}`,
            sourceId: sourceId ?? product.sourceId ?? 0,
          })
        : undefined

      const price = await updatePriceAndStock({
        images,
        published,
        payload: req.payload,
        productId: product.id,
        sourcePrice,
        stockQty,
        markupPercent,
      })

      result.updated += 1
      result.items.push({
        sku: sku ?? null,
        sourceId,
        status: 'updated',
        sourcePrice,
        price,
      })
      continue
    }

    if (parsedRequest.event === 'product.deactivated') {
      await req.payload.update({
        collection: 'products',
        id: product.id,
        data: {
          published: false,
        },
        overrideAccess: true,
      })

      result.deactivated += 1
      result.items.push({
        sku: sku ?? null,
        sourceId,
        status: 'deactivated',
      })
      continue
    }

    if (parsedRequest.event === 'product.deleted') {
      await req.payload.delete({
        collection: 'products',
        id: product.id,
        overrideAccess: true,
      })

      result.deleted += 1
      result.items.push({
        sku: sku ?? null,
        sourceId,
        status: 'deleted',
      })
    }
  }

  return Response.json(result, { status: 200 })
}
