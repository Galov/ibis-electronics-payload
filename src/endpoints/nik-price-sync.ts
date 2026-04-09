import type { PayloadHandler } from 'payload'

type NikPriceSyncItem = {
  sku?: unknown
  data?: {
    sourcePrice?: unknown
  }
}

const roundPrice = (value: number) => Math.round(value * 100) / 100

const getSourcePrice = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
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

  let payloadItems: unknown

  try {
    payloadItems = await req.json()
  } catch {
    return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!Array.isArray(payloadItems)) {
    return Response.json({ message: 'Body must be an array.' }, { status: 400 })
  }

  const pricingSettings = await req.payload.findGlobal({
    slug: 'pricing-settings',
    depth: 0,
    overrideAccess: true,
  })

  const markupPercent =
    typeof pricingSettings?.markupPercent === 'number' ? pricingSettings.markupPercent : 15

  const result = {
    markupPercent,
    processed: 0,
    updated: 0,
    notFound: 0,
    invalid: 0,
    items: [] as Array<{
      sku: string | null
      status: 'updated' | 'not_found' | 'invalid'
      message?: string
      sourcePrice?: number
      price?: number
    }>,
  }

  for (const item of payloadItems as NikPriceSyncItem[]) {
    result.processed += 1

    const sku = typeof item?.sku === 'string' ? item.sku.trim() : ''
    const sourcePrice = getSourcePrice(item?.data?.sourcePrice)

    if (!sku || sourcePrice === null) {
      result.invalid += 1
      result.items.push({
        sku: sku || null,
        status: 'invalid',
        message: 'Each item must include a valid sku and a positive numeric data.sourcePrice.',
      })
      continue
    }

    const products = await req.payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      select: {
        id: true,
        sku: true,
      },
      where: {
        sku: {
          equals: sku,
        },
      },
    })

    const product = products.docs[0]

    if (!product) {
      result.notFound += 1
      result.items.push({
        sku,
        status: 'not_found',
        message: 'No product with this sku was found in Ibis.',
      })
      continue
    }

    const price = roundPrice(sourcePrice * (1 + markupPercent / 100))

    await req.payload.update({
      collection: 'products',
      id: product.id,
      data: {
        sourcePrice,
        price,
      },
      overrideAccess: true,
    })

    result.updated += 1
    result.items.push({
      sku,
      status: 'updated',
      sourcePrice,
      price,
    })
  }

  return Response.json(result, { status: 200 })
}
