import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import type { Category, Product } from '../../src/payload-types'

type CategoryItem = Pick<
  Category,
  'id' | 'parent' | 'productCount' | 'slug' | 'sourceTaxonomyId' | 'sourceTermId' | 'title'
>

type ProductItem = Pick<Product, 'id' | 'categories'>
type ProductCategoryValue = NonNullable<ProductItem['categories']>[number]

type DuplicateGroup = {
  keep: CategoryItem
  merge: CategoryItem[]
}

const batchSize = 200

const shouldApply = process.argv.includes('--apply')

const normalizeTitle = (value?: string | null) => String(value || '').trim().toLocaleLowerCase('bg-BG')

const getParentID = (category: CategoryItem) => {
  if (!category.parent) return 'root'
  if (typeof category.parent === 'string') return category.parent
  return category.parent.id
}

const getParentTitle = (category: CategoryItem) => {
  if (!category.parent) return null
  if (typeof category.parent === 'string') return category.parent
  return category.parent.title
}

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
  const payload = await getPayload({ config })
  const docs: T[] = []
  let page = 1

  while (true) {
    const result = await payload.find({
      collection,
      depth: 1,
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

const buildDuplicateGroups = (categories: CategoryItem[]): DuplicateGroup[] => {
  const bySiblingTitle = new Map<string, CategoryItem[]>()

  for (const category of categories) {
    const key = `${getParentID(category)}::${normalizeTitle(category.title)}`
    const items = bySiblingTitle.get(key) || []
    items.push(category)
    bySiblingTitle.set(key, items)
  }

  return [...bySiblingTitle.values()]
    .filter((items) => items.length > 1)
    .map((items) => {
      const sorted = [...items].sort((left, right) => {
        const countDiff = (right.productCount || 0) - (left.productCount || 0)
        if (countDiff !== 0) return countDiff
        return String(left.id).localeCompare(String(right.id))
      })

      return {
        keep: sorted[0],
        merge: sorted.slice(1),
      }
    })
}

const main = async () => {
  const payload = await getPayload({ config })
  const categories = await fetchAll<CategoryItem>({
    collection: 'categories',
    select: {
      parent: true,
      productCount: true,
      slug: true,
      sourceTaxonomyId: true,
      sourceTermId: true,
      title: true,
    },
  })

  const duplicateGroups = buildDuplicateGroups(categories)
  const mergeTargetByCategoryID = new Map<string, string>()

  for (const group of duplicateGroups) {
    for (const category of group.merge) {
      mergeTargetByCategoryID.set(category.id, group.keep.id)
    }
  }

  const products = await fetchAll<ProductItem>({
    collection: 'products',
    select: {
      categories: true,
    },
  })

  let productsToUpdate = 0
  let categoryReferencesToMove = 0

  for (const product of products) {
    const categoryIDs = (product.categories || []).map(getCategoryID).filter(Boolean) as string[]
    const nextCategoryIDs = new Set<string>()
    let changed = false

    for (const categoryID of categoryIDs) {
      const targetID = mergeTargetByCategoryID.get(categoryID)

      if (targetID) {
        nextCategoryIDs.add(targetID)
        categoryReferencesToMove += 1
        changed = true
        continue
      }

      nextCategoryIDs.add(categoryID)
    }

    if (!changed) continue

    productsToUpdate += 1

    if (shouldApply) {
      await payload.update({
        id: product.id,
        collection: 'products',
        data: {
          categories: [...nextCategoryIDs],
        },
        overrideAccess: true,
      })
    }

    if (productsToUpdate % 100 === 0) {
      console.log(`${shouldApply ? 'Updated' : 'Would update'} ${productsToUpdate} products...`)
    }
  }

  let deletedCategories = 0

  if (shouldApply) {
    for (const categoryID of mergeTargetByCategoryID.keys()) {
      await payload.delete({
        id: categoryID,
        collection: 'categories',
        overrideAccess: true,
      })

      deletedCategories += 1

      if (deletedCategories % 100 === 0) {
        console.log(`Deleted ${deletedCategories} duplicate categories...`)
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? 'apply' : 'dry-run',
        duplicateGroups: duplicateGroups.length,
        duplicateCategoriesToDelete: mergeTargetByCategoryID.size,
        categoryReferencesToMove,
        productsToUpdate,
        deletedCategories,
        sample: duplicateGroups.slice(0, 20).map((group) => ({
          keep: {
            id: group.keep.id,
            parent: getParentTitle(group.keep),
            productCount: group.keep.productCount || 0,
            sourceTaxonomyId: group.keep.sourceTaxonomyId,
            title: group.keep.title,
          },
          merge: group.merge.map((category) => ({
            id: category.id,
            parent: getParentTitle(category),
            productCount: category.productCount || 0,
            sourceTaxonomyId: category.sourceTaxonomyId,
            title: category.title,
          })),
        })),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
