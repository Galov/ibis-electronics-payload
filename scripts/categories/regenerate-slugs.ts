import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { buildCategorySlug } from '@/utilities/category'

type CategoryDoc = {
  id: string
  parent?: null | string
  slug?: null | string
  title: string
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    sort: 'title',
  })

  const categories = result.docs as CategoryDoc[]
  const byId = new Map(categories.map((category) => [category.id, category]))
  const resolvedSlugs = new Map<string, string>()
  const visiting = new Set<string>()

  const resolveSlug = (category: CategoryDoc): string => {
    const existing = resolvedSlugs.get(category.id)
    if (existing) return existing

    if (visiting.has(category.id)) {
      throw new Error(`Circular category hierarchy detected for ${category.id}`)
    }

    visiting.add(category.id)

    if (category.parent && byId.has(category.parent)) {
      resolveSlug(byId.get(category.parent)!)
    }

    const slug = buildCategorySlug({ title: category.title })

    visiting.delete(category.id)
    resolvedSlugs.set(category.id, slug)

    return slug
  }

  for (const category of categories) {
    resolveSlug(category)
  }

  for (const category of categories) {
    await payload.update({
      id: category.id,
      collection: 'categories',
      data: {
        slug: `__tmp__${category.id}`,
      },
      overrideAccess: true,
    })
  }

  for (const category of categories) {
    const slug = resolvedSlugs.get(category.id)

    if (!slug) continue

    await payload.update({
      id: category.id,
      collection: 'categories',
      data: {
        slug,
      },
      overrideAccess: true,
    })

    payload.logger.info(`Updated category "${category.title}" -> ${slug}`)
  }

  payload.logger.info(`Done. Regenerated slugs for ${categories.length} categories.`)
}

void run()
