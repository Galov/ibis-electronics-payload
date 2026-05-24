import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

type CategoryDoc = {
  id: string
  productCount?: number | null
  title: string
}

type ProductDoc = {
  id: string
  categories?: Array<{ id: string } | string | null> | null
}

type ProductCategoryValue = NonNullable<ProductDoc['categories']>[number]

const batchSize = 200

const getCategoryID = (value: ProductCategoryValue) => {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

const fetchAll = async <T extends { id: string }>({
  collection,
  select,
}: {
  collection: 'categories' | 'products'
  select: Record<string, true>
}) => {
  const payload = await getPayload({ config: configPromise })
  const docs: T[] = []
  let page = 1

  while (true) {
    const result = await payload.find({
      collection,
      depth: 0,
      limit: batchSize,
      overrideAccess: true,
      page,
      pagination: true,
      select,
    })

    docs.push(...(result.docs as unknown as T[]))

    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  const [categories, products] = await Promise.all([
    fetchAll<CategoryDoc>({
      collection: 'categories',
      select: {
        productCount: true,
        title: true,
      },
    }),
    fetchAll<ProductDoc>({
      collection: 'products',
      select: {
        categories: true,
      },
    }),
  ])

  const counts = new Map<string, number>()

  for (const category of categories) {
    counts.set(category.id, 0)
  }

  for (const product of products) {
    const uniqueCategoryIDs = new Set(
      (product.categories || []).map(getCategoryID).filter(Boolean) as string[],
    )

    for (const categoryID of uniqueCategoryIDs) {
      counts.set(categoryID, (counts.get(categoryID) || 0) + 1)
    }
  }

  let updated = 0
  const changed: Array<{
    id: string
    next: number
    prev: number
    title: string
  }> = []

  for (const category of categories) {
    const next = counts.get(category.id) || 0
    const prev = category.productCount || 0

    if (next === prev) continue

    await payload.update({
      id: category.id,
      collection: 'categories',
      data: {
        productCount: next,
      },
      overrideAccess: true,
    })

    updated += 1
    changed.push({
      id: category.id,
      next,
      prev,
      title: category.title,
    })

    if (updated % 100 === 0) {
      payload.logger.info(`Updated ${updated} category counts...`)
    }
  }

  console.log(
    JSON.stringify(
      {
        categoriesTotal: categories.length,
        changedSample: changed.slice(0, 30),
        productsTotal: products.length,
        updated,
      },
      null,
      2,
    ),
  )
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
