import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

import { buildCategoryPath, buildCategoryPublicSegments } from '@/utilities/category'

type Props = {
  params: Promise<{
    slug: string[]
  }>
}

type LegacyCategoryPageData = {
  id: string
  parent?:
    | {
        parent?: LegacyCategoryPageData['parent']
        slug?: string | null
        title?: string | null
      }
    | string
    | null
  slug?: string | null
  title: string
}

const queryCategoryBySegments = async ({ segments }: { segments: string[] }) => {
  const requestedSegments = segments.map((segment) => decodeURIComponent(segment))
  const lastSegment = requestedSegments.at(-1)

  if (!lastSegment) return null

  const previousSegment = requestedSegments.at(-2)
  const targetSlug =
    previousSegment && lastSegment.startsWith(`${previousSegment}-`)
      ? lastSegment.slice(previousSegment.length + 1)
      : lastSegment

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'categories',
    depth: 10,
    limit: 1000,
    pagination: false,
    where: {
      slug: {
        equals: targetSlug,
      },
    },
  })

  return (
    (result.docs as LegacyCategoryPageData[]).find((doc) => {
      const actualSegments = buildCategoryPublicSegments(doc)
      return actualSegments.join('/') === requestedSegments.join('/')
    }) || null
  )
}

export default async function LegacyCategoryPage({ params }: Props) {
  const { slug } = await params

  if (!slug?.length) {
    redirect('/shop')
  }

  const category = await queryCategoryBySegments({ segments: slug })

  if (category) {
    redirect(buildCategoryPath(category))
  }

  const normalizedSearchTerm = decodeURIComponent(slug.at(-1) || '')
    .replace(/^[^-]+-/, '')
    .replace(/-/g, ' ')
    .trim()

  if (!normalizedSearchTerm) {
    redirect('/shop')
  }

  const qs = new URLSearchParams({
    q: normalizedSearchTerm,
  })

  redirect(`/magazin?${qs.toString()}`)
}
