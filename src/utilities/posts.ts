import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Post } from '@/payload-types'

const postListSelect = {
  categories: true,
  excerpt: true,
  featuredImage: true,
  meta: true,
  publishedAt: true,
  relatedPosts: true,
  slug: true,
  title: true,
  updatedAt: true,
} as const

export const queryPublishedPosts = async ({
  limit = 12,
}: {
  limit?: number
} = {}): Promise<Post[]> => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
    depth: 2,
    draft: false,
    limit,
    overrideAccess: false,
    pagination: false,
    select: postListSelect,
    sort: '-publishedAt',
    where: {
      _status: {
        equals: 'published',
      },
    },
  })

  return result.docs as Post[]
}

export const queryPostBySlug = async (slug: string): Promise<Post | null> => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
    depth: 2,
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    sort: '-publishedAt',
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          _status: {
            equals: 'published',
          },
        },
      ],
    },
  })

  return (result.docs?.[0] as Post | undefined) || null
}
