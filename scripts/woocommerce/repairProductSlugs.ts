import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Product } from '@/payload-types'
import { decodeMangledLegacySlug, ensureLegacySlug } from '@/utilities/legacySlugs'

type ProductSlugDoc = Pick<Product, 'id' | 'slug' | 'sourceId' | 'title'>

type RepairCandidate = {
  id: string
  nextSlug: string
  previousSlug: string
  sourceId?: number | null
  title: string
}

const isDryRun = process.env.REPAIR_PRODUCT_SLUGS_DRY_RUN !== 'false'

const fetchAllProducts = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<ProductSlugDoc[]> => {
  const products: ProductSlugDoc[] = []
  let page = 1

  while (true) {
    const result = await payload.find({
      collection: 'products',
      depth: 0,
      limit: 500,
      overrideAccess: true,
      page,
      pagination: true,
      select: {
        slug: true,
        sourceId: true,
        title: true,
      },
    })

    products.push(...(result.docs as ProductSlugDoc[]))

    if (!result.hasNextPage) break
    page += 1
  }

  return products
}

const buildUniqueSlug = ({
  baseSlug,
  currentId,
  reservedSlugs,
  slugOwnerBySlug,
}: {
  baseSlug: string
  currentId: string
  reservedSlugs: Set<string>
  slugOwnerBySlug: Map<string, string>
}) => {
  let nextSlug = baseSlug
  let suffix = 2

  while (true) {
    const existingOwner = slugOwnerBySlug.get(nextSlug)

    if ((!existingOwner || existingOwner === currentId) && !reservedSlugs.has(nextSlug)) {
      reservedSlugs.add(nextSlug)
      return nextSlug
    }

    nextSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

const buildRepairCandidates = (products: ProductSlugDoc[]): RepairCandidate[] => {
  const slugOwnerBySlug = new Map<string, string>()
  const reservedSlugs = new Set<string>()

  for (const product of products) {
    if (product.slug) slugOwnerBySlug.set(product.slug, product.id)
  }

  return products.flatMap((product) => {
    if (!product.slug) return []

    const decodedSlug = decodeMangledLegacySlug(product.slug)
    if (!decodedSlug) return []

    const fallbackSourceId = typeof product.sourceId === 'number' ? product.sourceId : 0
    const baseSlug = ensureLegacySlug(decodedSlug, product.title, fallbackSourceId)
    const nextSlug = buildUniqueSlug({
      baseSlug,
      currentId: product.id,
      reservedSlugs,
      slugOwnerBySlug,
    })

    if (nextSlug === product.slug) return []

    return [
      {
        id: product.id,
        nextSlug,
        previousSlug: product.slug,
        sourceId: product.sourceId,
        title: product.title,
      },
    ]
  })
}

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const products = await fetchAllProducts(payload)
  const candidates = buildRepairCandidates(products)

  console.log(
    JSON.stringify(
      {
        dryRun: isDryRun,
        products: products.length,
        repairCandidates: candidates.length,
        sample: candidates.slice(0, 20),
      },
      null,
      2,
    ),
  )

  if (isDryRun) return

  let repaired = 0

  for (const candidate of candidates) {
    await payload.update({
      id: candidate.id,
      collection: 'products',
      data: {
        slug: candidate.nextSlug,
      },
      overrideAccess: true,
    })

    repaired += 1

    if (repaired % 100 === 0) {
      payload.logger.info(`Repaired ${repaired}/${candidates.length} product slugs...`)
    }
  }

  payload.logger.info(`Repaired ${repaired} product slugs.`)
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
