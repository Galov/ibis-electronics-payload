import type { Metadata } from 'next'

import React from 'react'

import { PostArchive } from '@/components/blog/PostArchive'
import { generateMeta } from '@/utilities/generateMeta'
import { queryPublishedPosts } from '@/utilities/posts'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    fallbackDescription: 'Новини, съвети и полезни статии от Ibis Electronics.',
    fallbackTitle: 'Блог',
    path: '/blog',
  })
}

export default async function BlogPage() {
  const posts = await queryPublishedPosts()

  return (
    <div className="container py-12 md:py-16">
      <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary/55">Блог</p>
        <h1 className="text-4xl font-semibold tracking-tight text-primary md:text-5xl">
          Статии, насоки и полезно съдържание
        </h1>
        <p className="text-base leading-7 text-primary/70 md:text-lg">
          Тук публикуваме практически материали за избор, поддръжка и работа с уреди и компоненти.
        </p>
      </div>

      <PostArchive posts={posts} />
    </div>
  )
}
