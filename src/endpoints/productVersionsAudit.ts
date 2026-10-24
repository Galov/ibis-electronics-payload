import { saveVersion, type PayloadHandler } from 'payload'

import { checkRole } from '@/access/utilities'
import type { Product } from '@/payload-types'

type ProductSummary = {
  id: string
  published?: boolean | null
  sku?: null | string
  slug?: null | string
  sourceId?: null | number
  sourcePrice?: null | number
  status?: null | string
  stockQty?: null | number
  stockStatus?: null | string
  createdAt?: string
  updatedAt?: string
}

type VersionSummary = {
  id: string
  latest?: boolean
  parentId: null | string
  published?: boolean | null
  sku?: null | string
  slug?: null | string
  sourceId?: null | number
  sourcePrice?: null | number
  status?: null | string
  stockQty?: null | number
  stockStatus?: null | string
}

type DuplicateSummary<TEntry> = {
  count: number
  value: string
  entries: TEntry[]
}

const DEFAULT_SAMPLE_LIMIT = 20
const MAX_SAMPLE_LIMIT = 100
const DEFAULT_BATCH_SIZE = 250
const MAX_BATCH_SIZE = 500

const isApplyRequest = (method: string | undefined, url: URL): boolean => {
  return method === 'POST' && url.searchParams.get('apply') === 'true'
}

const parsePositiveInt = ({
  defaultValue,
  maxValue,
  param,
  url,
}: {
  defaultValue: number
  maxValue: number
  param: string
  url: URL
}): number => {
  const rawValue = url.searchParams.get(param)
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : defaultValue

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue
  }

  return Math.min(parsed, maxValue)
}

const parseMaxProducts = (url: URL): null | number => {
  const rawValue = url.searchParams.get('maxProducts')

  if (!rawValue) {
    return null
  }

  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const getRelationshipId = (value: unknown): null | string => {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }

  return null
}

const normalizeValue = (value: null | string | undefined): null | string => {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const toProductSummary = (product: Product): ProductSummary => ({
  createdAt: product.createdAt,
  id: product.id,
  published: product.published,
  sku: product.sku,
  slug: product.slug,
  sourceId: product.sourceId,
  sourcePrice: product.sourcePrice,
  status: product._status,
  stockQty: product.stockQty,
  stockStatus: product.stockStatus,
  updatedAt: product.updatedAt,
})

const toVersionSummary = (versionDoc: Record<string, unknown>): VersionSummary => {
  const version = (versionDoc.version || {}) as Partial<Product>

  return {
    id: String(versionDoc.id),
    latest: versionDoc.latest === true,
    parentId: getRelationshipId(versionDoc.parent),
    published: version.published,
    sku: version.sku,
    slug: version.slug,
    sourceId: version.sourceId,
    sourcePrice: version.sourcePrice,
    status: version._status,
    stockQty: version.stockQty,
    stockStatus: version.stockStatus,
  }
}

const getMismatchReasons = (product: ProductSummary, version: VersionSummary): string[] => {
  const reasons: string[] = []

  if (normalizeValue(version.sku) !== normalizeValue(product.sku)) {
    reasons.push('sku')
  }

  if (normalizeValue(version.slug) !== normalizeValue(product.slug)) {
    reasons.push('slug')
  }

  if (version.status !== product.status) {
    reasons.push('status')
  }

  return reasons
}

const pushLimited = <T>(items: T[], item: T, limit: number) => {
  if (items.length < limit) {
    items.push(item)
  }
}

const collectDuplicates = <TEntry>(
  values: Map<string, TEntry[]>,
  sampleLimit: number,
): DuplicateSummary<TEntry>[] => {
  const duplicates: DuplicateSummary<TEntry>[] = []

  for (const [value, entries] of values.entries()) {
    if (entries.length > 1) {
      duplicates.push({
        count: entries.length,
        entries: entries.slice(0, sampleLimit),
        value,
      })
    }
  }

  return duplicates.sort((a, b) => b.count - a.count).slice(0, sampleLimit)
}

export const productVersionsAuditHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requestUrl = new URL(req.url || 'http://localhost')
    const sampleLimit = parsePositiveInt({
      defaultValue: DEFAULT_SAMPLE_LIMIT,
      maxValue: MAX_SAMPLE_LIMIT,
      param: 'sampleLimit',
      url: requestUrl,
    })
    const batchSize = parsePositiveInt({
      defaultValue: DEFAULT_BATCH_SIZE,
      maxValue: MAX_BATCH_SIZE,
      param: 'batchSize',
      url: requestUrl,
    })
    const maxProducts = parseMaxProducts(requestUrl)
    const anyVersionParents = new Set<string>()
    const latestVersionByParent = new Map<string, VersionSummary>()
    const productById = new Map<string, Product>()
    const productSlugs = new Map<string, ProductSummary[]>()
    const productSkus = new Map<string, ProductSummary[]>()
    const latestVersionSlugs = new Map<string, VersionSummary[]>()
    const latestVersionSkus = new Map<string, VersionSummary[]>()
    const missingAnyVersion: ProductSummary[] = []
    const missingLatestVersion: ProductSummary[] = []
    const latestVersionMismatch: {
      product: ProductSummary
      reasons: string[]
      version: VersionSummary
    }[] = []
    const mismatchBreakdown = {
      sku: 0,
      slug: 0,
      status: 0,
      statusOnly: 0,
      statusOnlyWithZeroStock: 0,
      statusOnlyWithZeroStockAndNikUnpublished: 0,
    }
    let checkedProducts = 0
    let checkedVersions = 0
    let latestVersionMismatchCount = 0
    let page = 1

    while (maxProducts === null || checkedProducts < maxProducts) {
      const remaining = maxProducts === null ? batchSize : Math.min(batchSize, maxProducts - checkedProducts)

      if (remaining <= 0) {
        break
      }

      const productsResult = await req.payload.find({
        collection: 'products',
        depth: 0,
        limit: remaining,
        overrideAccess: true,
        page,
        pagination: true,
        select: {
          _status: true,
          createdAt: true,
          published: true,
          sku: true,
          slug: true,
          sourceId: true,
          sourcePrice: true,
          stockQty: true,
          stockStatus: true,
          updatedAt: true,
        },
        sort: 'id',
      })

      const products = productsResult.docs as Product[]

      if (products.length === 0) {
        break
      }

      const productIds = products.map((product) => product.id)
      const versionsResult = await req.payload.findVersions({
        collection: 'products',
        depth: 0,
        limit: 0,
        overrideAccess: true,
        pagination: false,
        sort: 'id',
        select: {
          latest: true,
          parent: true,
          version: {
            _status: true,
            published: true,
            sku: true,
            slug: true,
            sourceId: true,
            sourcePrice: true,
            stockQty: true,
            stockStatus: true,
          },
        },
        where: {
          parent: {
            in: productIds,
          },
        },
      })

      const versions = versionsResult.docs as unknown as Record<string, unknown>[]
      const batchAnyVersionParents = new Set<string>()
      const batchLatestVersionByParent = new Map<string, VersionSummary>()

      checkedProducts += products.length
      checkedVersions += versions.length

      for (const product of products) {
        productById.set(product.id, product)

        const productSummary = toProductSummary(product)
        const slug = normalizeValue(product.slug)
        const sku = normalizeValue(product.sku)

        if (slug) {
          productSlugs.set(slug, [...(productSlugs.get(slug) || []), productSummary])
        }

        if (sku) {
          productSkus.set(sku, [...(productSkus.get(sku) || []), productSummary])
        }
      }

      for (const versionDoc of versions) {
        const versionSummary = toVersionSummary(versionDoc)

        if (!versionSummary.parentId) {
          continue
        }

        anyVersionParents.add(versionSummary.parentId)
        batchAnyVersionParents.add(versionSummary.parentId)

        if (versionSummary.latest) {
          latestVersionByParent.set(versionSummary.parentId, versionSummary)
          batchLatestVersionByParent.set(versionSummary.parentId, versionSummary)

          const slug = normalizeValue(versionSummary.slug)
          const sku = normalizeValue(versionSummary.sku)

          if (slug) {
            latestVersionSlugs.set(slug, [...(latestVersionSlugs.get(slug) || []), versionSummary])
          }

          if (sku) {
            latestVersionSkus.set(sku, [...(latestVersionSkus.get(sku) || []), versionSummary])
          }
        }
      }

      for (const product of products) {
        const productSummary = toProductSummary(product)
        const latestVersion = batchLatestVersionByParent.get(product.id)

        if (!batchAnyVersionParents.has(product.id)) {
          pushLimited(missingAnyVersion, productSummary, sampleLimit)
        }

        if (!latestVersion) {
          pushLimited(missingLatestVersion, productSummary, sampleLimit)
          continue
        }

        const reasons = getMismatchReasons(productSummary, latestVersion)

        if (reasons.length > 0) {
          latestVersionMismatchCount += 1
          const reasonSet = new Set(reasons)

          if (reasonSet.has('sku')) {
            mismatchBreakdown.sku += 1
          }

          if (reasonSet.has('slug')) {
            mismatchBreakdown.slug += 1
          }

          if (reasonSet.has('status')) {
            mismatchBreakdown.status += 1
          }

          if (reasons.length === 1 && reasonSet.has('status')) {
            mismatchBreakdown.statusOnly += 1

            if ((product.stockQty || 0) <= 0) {
              mismatchBreakdown.statusOnlyWithZeroStock += 1
            }

            if ((product.stockQty || 0) <= 0 && product.published === false) {
              mismatchBreakdown.statusOnlyWithZeroStockAndNikUnpublished += 1
            }
          }

          pushLimited(
            latestVersionMismatch,
            {
              product: productSummary,
              reasons,
              version: latestVersion,
            },
            sampleLimit,
          )
        }
      }

      if (!productsResult.hasNextPage) {
        break
      }

      page += 1
    }

    const orphanLatestVersions = [...latestVersionByParent.values()].filter((version) => {
      return version.parentId ? !productById.has(version.parentId) : true
    })

    return Response.json(
      {
        counts: {
          latestVersionMismatch: latestVersionMismatchCount,
          missingAnyVersion: checkedProducts - [...anyVersionParents].filter((id) => productById.has(id)).length,
          missingLatestVersion: checkedProducts - [...latestVersionByParent.keys()].filter((id) => productById.has(id)).length,
          orphanLatestVersions: orphanLatestVersions.length,
          products: checkedProducts,
          productSkuDuplicates: collectDuplicates(productSkus, 1).length,
          productSlugDuplicates: collectDuplicates(productSlugs, 1).length,
          versions: checkedVersions,
          versionSkuDuplicates: collectDuplicates(latestVersionSkus, 1).length,
          versionSlugDuplicates: collectDuplicates(latestVersionSlugs, 1).length,
          withAnyVersion: [...anyVersionParents].filter((id) => productById.has(id)).length,
          withLatestVersion: [...latestVersionByParent.keys()].filter((id) => productById.has(id)).length,
        },
        samples: {
          latestVersionMismatch,
          missingAnyVersion,
          missingLatestVersion,
          orphanLatestVersions: orphanLatestVersions.slice(0, sampleLimit),
          productSkuDuplicates: collectDuplicates(productSkus, sampleLimit),
          productSlugDuplicates: collectDuplicates(productSlugs, sampleLimit),
          versionSkuDuplicates: collectDuplicates(latestVersionSkus, sampleLimit),
          versionSlugDuplicates: collectDuplicates(latestVersionSlugs, sampleLimit),
        },
        mismatchBreakdown,
        scan: {
          batchSize,
          maxProducts,
          sampleLimit,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ message }, { status: 500 })
  }
}

export const productVersionsRepairHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requestUrl = new URL(req.url || 'http://localhost')
    const apply = isApplyRequest(req.method, requestUrl)
    const sampleLimit = parsePositiveInt({
      defaultValue: DEFAULT_SAMPLE_LIMIT,
      maxValue: MAX_SAMPLE_LIMIT,
      param: 'sampleLimit',
      url: requestUrl,
    })
    const batchSize = parsePositiveInt({
      defaultValue: DEFAULT_BATCH_SIZE,
      maxValue: MAX_BATCH_SIZE,
      param: 'batchSize',
      url: requestUrl,
    })
    const maxProducts = parseMaxProducts(requestUrl)
    const collectionConfig = req.payload.collections.products.config
    const missingVersionSamples: ProductSummary[] = []
    const repairedSamples: ProductSummary[] = []
    const errorSamples: { error: string; product: ProductSummary }[] = []
    let checkedProducts = 0
    let productsWithoutAnyVersion = 0
    let repairedProducts = 0
    let errors = 0
    let page = 1

    while (maxProducts === null || checkedProducts < maxProducts) {
      const remaining = maxProducts === null ? batchSize : Math.min(batchSize, maxProducts - checkedProducts)

      if (remaining <= 0) {
        break
      }

      const productsResult = await req.payload.find({
        collection: 'products',
        depth: 0,
        limit: remaining,
        overrideAccess: true,
        page,
        pagination: true,
        sort: 'id',
      })

      const products = productsResult.docs as Product[]

      if (products.length === 0) {
        break
      }

      const productIds = products.map((product) => product.id)
      const versionsResult = await req.payload.findVersions({
        collection: 'products',
        depth: 0,
        limit: 0,
        overrideAccess: true,
        pagination: false,
        select: {
          parent: true,
        },
        sort: 'id',
        where: {
          parent: {
            in: productIds,
          },
        },
      })
      const versionParentIds = new Set(
        (versionsResult.docs as unknown as Record<string, unknown>[])
          .map((versionDoc) => getRelationshipId(versionDoc.parent))
          .filter((parentId): parentId is string => Boolean(parentId)),
      )

      checkedProducts += products.length

      for (const product of products) {
        if (versionParentIds.has(product.id)) {
          continue
        }

        const productSummary = toProductSummary(product)
        productsWithoutAnyVersion += 1
        pushLimited(missingVersionSamples, productSummary, sampleLimit)

        if (!apply) {
          continue
        }

        try {
          await saveVersion({
            autosave: true,
            collection: collectionConfig,
            docWithLocales: product,
            id: product.id,
            operation: 'create',
            payload: req.payload,
            req,
            returning: false,
          })

          repairedProducts += 1
          pushLimited(repairedSamples, productSummary, sampleLimit)
        } catch (error) {
          errors += 1
          pushLimited(
            errorSamples,
            {
              error: error instanceof Error ? error.message : 'Unknown error',
              product: productSummary,
            },
            sampleLimit,
          )
        }
      }

      if (!productsResult.hasNextPage) {
        break
      }

      page += 1
    }

    return Response.json(
      {
        counts: {
          checkedProducts,
          errors,
          productsWithoutAnyVersion,
          repairedProducts,
        },
        mode: apply ? 'apply' : 'dry-run',
        samples: {
          errors: errorSamples,
          missingVersions: missingVersionSamples,
          repaired: repairedSamples,
        },
        scan: {
          batchSize,
          maxProducts,
          sampleLimit,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ message }, { status: 500 })
  }
}
