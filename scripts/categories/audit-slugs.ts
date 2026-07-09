import fs from 'node:fs'
import path from 'node:path'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { buildCategoryPath, buildCategorySlug } from '@/utilities/category'

type CategoryDoc = {
  id: string
  parent?: null | string
  slug?: null | string
  title: string
}

type CategoryNode = CategoryDoc & {
  currentPath: string
  nextPath: string
  nextSlug: string
  parentDoc?: CategoryNode | null
}

const resolveEnvFromFile = () => {
  const envPath = path.resolve(process.cwd(), '.env')

  if (!fs.existsSync(envPath)) {
    return
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const databaseURL = envContent.match(/^DATABASE_URL=(.*)$/m)?.[1]

  if (databaseURL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = databaseURL
  }
}

const buildNextCategoryPath = (category?: CategoryNode | null) => {
  const chain: string[] = []
  let current: CategoryNode | null | undefined = category

  while (current) {
    chain.unshift(current.nextSlug)
    current = current.parentDoc
  }

  const publicSegments = chain.reduce<string[]>((acc, segment) => {
    if (acc.length === 0) {
      acc.push(segment)
      return acc
    }

    acc.push(`${acc[acc.length - 1]}-${segment}`)
    return acc
  }, [])

  return publicSegments.length > 0 ? `/cat/${publicSegments.map(encodeURIComponent).join('/')}` : '/shop'
}

const run = async () => {
  resolveEnvFromFile()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    sort: 'title',
  })

  const rawCategories = result.docs as CategoryDoc[]
  const baseNodes = new Map<string, CategoryNode>(
    rawCategories.map((category) => [
      category.id,
      {
        ...category,
        currentPath: '',
        nextPath: '',
        nextSlug: buildCategorySlug({ title: category.title }),
        parentDoc: null,
      },
    ]),
  )

  for (const node of baseNodes.values()) {
    node.parentDoc = node.parent ? baseNodes.get(node.parent) || null : null
  }

  for (const node of baseNodes.values()) {
    node.currentPath = buildCategoryPath(node)
    node.nextPath = buildNextCategoryPath(node)
  }

  const nodes = [...baseNodes.values()]
  const mangledNodes = nodes.filter((node) => typeof node.slug === 'string' && /d0|d1/i.test(node.slug))

  const siblingGroups = new Map<string, CategoryNode[]>()

  for (const node of nodes) {
    const parentKey = node.parent || '__root__'
    const key = `${parentKey}::${node.nextSlug}`

    if (!siblingGroups.has(key)) {
      siblingGroups.set(key, [])
    }

    siblingGroups.get(key)?.push(node)
  }

  const siblingConflicts = [...siblingGroups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      items: items.map((item) => ({
        currentPath: item.currentPath,
        currentSlug: item.slug || null,
        id: item.id,
        nextPath: item.nextPath,
        nextSlug: item.nextSlug,
        parent: item.parent || null,
        title: item.title,
      })),
    }))

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      mangledSlugCount: mangledNodes.length,
      sameParentSameSlugConflicts: siblingConflicts.length,
      totalCategories: nodes.length,
    },
    mangledSlugSample: mangledNodes.slice(0, 25).map((node) => ({
      currentPath: node.currentPath,
      currentSlug: node.slug || null,
      id: node.id,
      nextPath: node.nextPath,
      nextSlug: node.nextSlug,
      title: node.title,
    })),
    siblingConflicts,
    categories: nodes.map((node) => ({
      currentPath: node.currentPath,
      currentSlug: node.slug || null,
      id: node.id,
      nextPath: node.nextPath,
      nextSlug: node.nextSlug,
      parent: node.parent || null,
      title: node.title,
    })),
  }

  const outputDir = path.resolve(process.cwd(), '.local-notes')
  fs.mkdirSync(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, 'category-slug-audit.json')
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))

  console.log(
    JSON.stringify(
      {
        outputPath,
        summary: report.summary,
      },
      null,
      2,
    ),
  )
}

void run()
