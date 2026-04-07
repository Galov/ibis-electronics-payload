import { getPayload } from 'payload'

import config from '../../src/payload.config'
import type { Brand, Category, Product } from '../../src/payload-types'
import type {
  NormalizedBrand,
  NormalizedCategory,
  NormalizedProduct,
  ProductImportFailure,
} from './types'

type ExistingCategory = Pick<Category, 'id' | 'slug' | 'sourceTaxonomyId' | 'sourceTermId'>
type ExistingBrand = Pick<Brand, 'id' | 'slug' | 'sourceTaxonomyId' | 'sourceTermId'>
type ExistingProduct = Pick<Product, 'id' | 'slug' | 'sourceId'>

type ImportResult = {
  brandIdBySourceTaxonomyId: Map<number, string>
  categoryIdBySourceTaxonomyId: Map<number, string>
  failedProducts: ProductImportFailure[]
  succeededProducts: number
}

export async function importIntoPayload({
  batchSize,
  brands,
  categories,
  products,
}: {
  batchSize: number
  brands: NormalizedBrand[]
  categories: NormalizedCategory[]
  products: NormalizedProduct[]
}): Promise<ImportResult> {
  const payload = await getPayload({ config })
  const failedProducts: ProductImportFailure[] = []

  const existingCategories = await fetchAll<ExistingCategory>({
    collection: 'categories',
    payload,
    select: {
      slug: true,
      sourceTaxonomyId: true,
      sourceTermId: true,
    },
  })

  const categoryIdBySourceTaxonomyId = await upsertCategories(payload, categories, existingCategories)

  const existingBrands = await fetchAll<ExistingBrand>({
    collection: 'brands',
    payload,
    select: {
      slug: true,
      sourceTaxonomyId: true,
      sourceTermId: true,
    },
  })

  const brandIdBySourceTaxonomyId = await upsertBrands(payload, brands, existingBrands)

  const existingProducts = await fetchAll<ExistingProduct>({
    collection: 'products',
    payload,
    select: {
      slug: true,
      sourceId: true,
    },
  })

  await upsertProducts(payload, {
    batchSize,
    brandIdBySourceTaxonomyId,
    categoryIdBySourceTaxonomyId,
    existingProducts,
    failedProducts,
    products,
  })

  return {
    brandIdBySourceTaxonomyId,
    categoryIdBySourceTaxonomyId,
    failedProducts,
    succeededProducts: products.length - failedProducts.length,
  }
}

async function upsertCategories(
  payload: Awaited<ReturnType<typeof getPayload>>,
  categories: NormalizedCategory[],
  existing: ExistingCategory[],
): Promise<Map<number, string>> {
  const idBySourceTaxonomyId = new Map<number, string>()
  const existingBySourceTaxonomyId = new Map<number, ExistingCategory>()

  for (const item of existing) {
    if (typeof item.sourceTaxonomyId === 'number') {
      existingBySourceTaxonomyId.set(item.sourceTaxonomyId, item)
      idBySourceTaxonomyId.set(item.sourceTaxonomyId, item.id)
    }
  }

  for (const category of categories) {
    const existingCategory = existingBySourceTaxonomyId.get(category.sourceTaxonomyId)
    const data = {
      parent: null as string | null,
      productCount: category.productCount,
      slug: category.slug,
      sourceTaxonomyId: category.sourceTaxonomyId,
      sourceTermId: category.sourceTermId,
      title: category.title,
    }

    if (existingCategory) {
      await payload.update({
        id: existingCategory.id,
        collection: 'categories',
        data,
        overrideAccess: true,
      })
      idBySourceTaxonomyId.set(category.sourceTaxonomyId, existingCategory.id)
      continue
    }

    const created = await payload.create({
      collection: 'categories',
      data,
      overrideAccess: true,
    })

    idBySourceTaxonomyId.set(category.sourceTaxonomyId, created.id)
  }

  const categoryIdBySourceTermId = new Map<number, string>()

  for (const category of categories) {
    const id = idBySourceTaxonomyId.get(category.sourceTaxonomyId)
    if (id) categoryIdBySourceTermId.set(category.sourceTermId, id)
  }

  for (const category of categories) {
    if (!category.parentSourceTermId) continue

    const childId = idBySourceTaxonomyId.get(category.sourceTaxonomyId)
    const parentId = categoryIdBySourceTermId.get(category.parentSourceTermId)

    if (!childId || !parentId) continue

    await payload.update({
      id: childId,
      collection: 'categories',
      data: {
        parent: parentId,
      },
      overrideAccess: true,
    })
  }

  return idBySourceTaxonomyId
}

async function upsertBrands(
  payload: Awaited<ReturnType<typeof getPayload>>,
  brands: NormalizedBrand[],
  existing: ExistingBrand[],
): Promise<Map<number, string>> {
  const idBySourceTaxonomyId = new Map<number, string>()
  const existingBySourceTaxonomyId = new Map<number, ExistingBrand>()

  for (const item of existing) {
    if (typeof item.sourceTaxonomyId === 'number') {
      existingBySourceTaxonomyId.set(item.sourceTaxonomyId, item)
      idBySourceTaxonomyId.set(item.sourceTaxonomyId, item.id)
    }
  }

  for (const brand of brands) {
    const existingBrand = existingBySourceTaxonomyId.get(brand.sourceTaxonomyId)
    const data = {
      productCount: brand.productCount,
      slug: brand.slug,
      sourceTaxonomyId: brand.sourceTaxonomyId,
      sourceTermId: brand.sourceTermId,
      title: brand.title,
    }

    if (existingBrand) {
      await payload.update({
        id: existingBrand.id,
        collection: 'brands',
        data,
        overrideAccess: true,
      })
      idBySourceTaxonomyId.set(brand.sourceTaxonomyId, existingBrand.id)
      continue
    }

    const created = await payload.create({
      collection: 'brands',
      data,
      overrideAccess: true,
    })

    idBySourceTaxonomyId.set(brand.sourceTaxonomyId, created.id)
  }

  return idBySourceTaxonomyId
}

async function upsertProducts(
  payload: Awaited<ReturnType<typeof getPayload>>,
  {
    batchSize,
    brandIdBySourceTaxonomyId,
    categoryIdBySourceTaxonomyId,
    existingProducts,
    failedProducts,
    products,
  }: {
    batchSize: number
    brandIdBySourceTaxonomyId: Map<number, string>
    categoryIdBySourceTaxonomyId: Map<number, string>
    existingProducts: ExistingProduct[]
    failedProducts: ProductImportFailure[]
    products: NormalizedProduct[]
  },
): Promise<void> {
  const existingBySourceId = new Map<number, ExistingProduct>()

  for (const product of existingProducts) {
    if (typeof product.sourceId === 'number') existingBySourceId.set(product.sourceId, product)
  }

  for (let index = 0; index < products.length; index += batchSize) {
    const batch = products.slice(index, index + batchSize)

    for (const product of batch) {
      const existingProduct = existingBySourceId.get(product.sourceId)

      const data = {
        backordersAllowed: product.backordersAllowed,
        brand: product.brandSourceTaxonomyId
          ? (brandIdBySourceTaxonomyId.get(product.brandSourceTaxonomyId) ?? null)
          : null,
        categories: product.categorySourceTaxonomyIds
          .map((sourceTaxonomyId) => categoryIdBySourceTaxonomyId.get(sourceTaxonomyId))
          .filter((value): value is string => Boolean(value)),
        description: product.description,
        images: product.images,
        imagesMigrated: product.imagesMigrated,
        inventory: product.stockQty,
        legacyAttachmentIDs: product.legacyAttachmentIDs,
        legacyModifiedAt: product.legacyModifiedAt,
        legacyProductUrl: product.legacyProductUrl,
        manageStock: product.manageStock,
        manufacturerCode: product.manufacturerCode,
        originalSku: product.originalSku,
        price: product.price,
        priceInUSD: product.price,
        published: product.published,
        shortDescription: product.shortDescription,
        sku: product.sku,
        slug: product.slug,
        sourceId: product.sourceId,
        stockQty: product.stockQty,
        stockStatus: product.stockStatus,
        title: product.title,
      }

      try {
        if (existingProduct) {
          await payload.update({
            id: existingProduct.id,
            collection: 'products',
            data,
            overrideAccess: true,
          })
          continue
        }

        const created = await payload.create({
          collection: 'products',
          data,
          overrideAccess: true,
        })

        existingBySourceId.set(product.sourceId, {
          id: created.id,
          slug: created.slug,
          sourceId: created.sourceId,
        })
      } catch (error) {
        const preview = (product.description || '').replace(/\s+/g, ' ').slice(0, 300)
        const failure = {
          batchStart: index,
          brandSourceTaxonomyId: product.brandSourceTaxonomyId,
          categorySourceTaxonomyIds: product.categorySourceTaxonomyIds,
          descriptionPreview: preview,
          error: extractErrorMessage(error),
          existingProductId: existingProduct?.id || null,
          productSlug: product.slug,
          sourceId: product.sourceId,
          title: product.title,
        } satisfies ProductImportFailure

        failedProducts.push(failure)

        console.error(
          JSON.stringify(failure, null, 2),
        )
      }
    }
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function fetchAll<T extends { id: string }>({
  collection,
  payload,
  select,
}: {
  collection: 'brands' | 'categories' | 'products'
  payload: Awaited<ReturnType<typeof getPayload>>
  select: Record<string, true>
}): Promise<T[]> {
  const docs: T[] = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      collection,
      depth: 0,
      limit: 200,
      overrideAccess: true,
      page,
      pagination: true,
      select,
    })

    docs.push(...(result.docs as unknown as T[]))
    hasNextPage = result.hasNextPage
    page += 1
  }

  return docs
}
