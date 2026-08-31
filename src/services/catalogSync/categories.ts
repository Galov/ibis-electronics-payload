import type { Payload, PayloadRequest } from 'payload'

import type { Category } from '@/payload-types'

import { CatalogSyncError } from './errors'
import type {
  CatalogSyncCategoryIdentity,
  CatalogSyncResolvedSourceCategory,
  CatalogSyncSourceProduct,
} from './types'

const maxCategoryDepth = 32

type CategoryRecord = Pick<Category, 'id' | 'parent' | 'title'>
type CategoryRelation = CategoryRecord['parent'] | number

const relationID = (relation: CategoryRelation, field: string): null | string => {
  if (relation === null || relation === undefined) return null
  if (typeof relation === 'string' || typeof relation === 'number') return String(relation)
  if (typeof relation === 'object' && relation.id !== null && relation.id !== undefined) {
    return String(relation.id)
  }
  throw new CatalogSyncError(
    'CATALOG_SYNC_CATEGORY_INVALID',
    `Категорийното дърво съдържа невалидна връзка в ${field}.`,
  )
}

const categoryIdentity = (category: CategoryRecord, field: string): CatalogSyncCategoryIdentity => {
  const id = relationID(category.id, `${field}.id`)
  const title = typeof category.title === 'string' ? category.title.trim() : ''
  if (!id || !title) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_CATEGORY_INVALID',
      `Категорията в ${field} няма валидни ID и име.`,
    )
  }
  return { sourceCategoryId: id, title }
}

const assignedCategoryID = (
  category: NonNullable<CatalogSyncSourceProduct['categories']>[number],
  index: number,
) => {
  if (typeof category === 'string' || typeof category === 'number') return String(category)
  if (category && typeof category === 'object')
    return relationID(category.id, `categories[${index}].id`)
  return null
}

export const resolveCatalogSyncCategoryPaths = async ({
  categories,
  findCategoryByID,
}: {
  categories: CatalogSyncSourceProduct['categories']
  findCategoryByID: (id: string) => Promise<CategoryRecord>
}): Promise<CatalogSyncResolvedSourceCategory[]> => {
  const cache = new Map<string, Promise<CategoryRecord>>()
  const load = (id: string, description: string) => {
    let pending = cache.get(id)
    if (!pending) {
      pending = findCategoryByID(id)
        .then((category) => {
          if (!category || typeof category !== 'object') {
            throw new Error('Category lookup returned no document.')
          }
          return category
        })
        .catch((cause) => {
          throw new CatalogSyncError(
            'CATALOG_SYNC_CATEGORY_MISSING',
            `${description} с ID „${id}“ липсва или не може да бъде заредена.`,
            { cause },
          )
        })
      cache.set(id, pending)
    }
    return pending
  }

  return Promise.all(
    (categories || []).map(async (assignedCategory, index) => {
      const assignedID = assignedCategoryID(assignedCategory, index)
      if (!assignedID) {
        throw new CatalogSyncError(
          'CATALOG_SYNC_CATEGORY_INVALID',
          `Зададената категория на позиция ${index + 1} няма валидно ID.`,
        )
      }

      const leaf = await load(assignedID, 'Зададената категория')
      const leafIdentity = categoryIdentity(leaf, `categories[${index}]`)
      const seen = new Set([leafIdentity.sourceCategoryId])
      const reversedAncestors: CatalogSyncCategoryIdentity[] = []
      let current = leaf

      while (true) {
        const parentID = relationID(current.parent, `category[${String(current.id)}].parent`)
        if (!parentID) break
        if (seen.has(parentID)) {
          throw new CatalogSyncError(
            'CATALOG_SYNC_CATEGORY_CYCLE',
            `Открит е цикъл в категорийното дърво при категория с ID „${parentID}“.`,
          )
        }
        if (reversedAncestors.length >= maxCategoryDepth) {
          throw new CatalogSyncError(
            'CATALOG_SYNC_CATEGORY_DEPTH_EXCEEDED',
            `Категорийният път за „${leafIdentity.title}“ надвишава максималните ${maxCategoryDepth} нива.`,
          )
        }

        const parent = await load(parentID, `Родителят на категория „${String(current.title)}“`)
        const parentIdentity = categoryIdentity(parent, `category[${parentID}]`)
        reversedAncestors.push(parentIdentity)
        seen.add(parentIdentity.sourceCategoryId)
        current = parent
      }

      return {
        ancestors: reversedAncestors.reverse(),
        id: leafIdentity.sourceCategoryId,
        title: leafIdentity.title,
      }
    }),
  )
}

const withResolvedCategories = async (
  product: CatalogSyncSourceProduct,
  findCategoryByID: (id: string) => Promise<CategoryRecord>,
) => ({
  ...product,
  categories: await resolveCatalogSyncCategoryPaths({
    categories: product.categories,
    findCategoryByID,
  }),
})

export const resolveCatalogSyncProductCategoriesForUser = async ({
  product,
  req,
}: {
  product: CatalogSyncSourceProduct
  req: PayloadRequest
}) =>
  withResolvedCategories(product, async (id) =>
    req.payload.findByID({
      collection: 'categories',
      depth: 0,
      id,
      overrideAccess: false,
      req,
      user: req.user,
    }),
  )

export const resolveCatalogSyncProductCategories = async ({
  payload,
  product,
  req,
}: {
  payload: Payload
  product: CatalogSyncSourceProduct
  req?: PayloadRequest
}) =>
  withResolvedCategories(product, async (id) =>
    payload.findByID({
      collection: 'categories',
      depth: 0,
      id,
      overrideAccess: true,
      ...(req ? { req } : {}),
    }),
  )
