import type { Metadata } from 'next'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import type { Post, PostCategory } from '@/payload-types'

import { Media } from '@/components/Media'
import { PostArchive } from '@/components/blog/PostArchive'
import { RichText } from '@/components/RichText'
import { generateMeta } from '@/utilities/generateMeta'
import { queryPostBySlug } from '@/utilities/posts'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{
    slug: string
  }>
}

const formatDate = (value?: null | string) => {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const getCategories = (categories?: Post['categories']) =>
  (categories || []).filter(
    (category): category is PostCategory =>
      Boolean(category && typeof category !== 'string' && category.title && category.slug),
  )

const getRelatedPosts = (relatedPosts?: Post['relatedPosts']) =>
  (relatedPosts || []).filter(
    (post): post is Post => Boolean(post && typeof post !== 'string' && post.slug && post.title),
  )

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const post = await queryPostBySlug(slug)

  if (!post) return {}

  const metaImage =
    post.featuredImage && typeof post.featuredImage === 'object'
      ? {
          alt: post.featuredImage.alt,
          url: post.featuredImage.url,
        }
      : undefined

  return generateMeta({
    doc: {
      ...post,
      meta: post.meta || (metaImage ? { image: metaImage } : undefined),
    },
    fallbackDescription: post.excerpt,
    fallbackTitle: post.title,
    path: `/blog/${post.slug || slug}`,
  })
}

export default async function BlogPostPage({ params }: Args) {
  const { slug } = await params
  const post = await queryPostBySlug(slug)

  if (!post) return notFound()

  const categories = getCategories(post.categories)
  const relatedPosts = getRelatedPosts(post.relatedPosts)
  const publishedAt = formatDate(post.publishedAt)
  const featuredImage =
    post.featuredImage && typeof post.featuredImage === 'object' ? post.featuredImage : null

  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto max-w-4xl">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/55">
          <Link className="transition hover:text-primary/80" href="/blog">
            Блог
          </Link>
          <span>/</span>
          <span className="text-primary/80">{post.title}</span>
        </nav>

        <header className="mb-10 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-primary/55">
            {publishedAt ? <time dateTime={post.publishedAt || undefined}>{publishedAt}</time> : null}
            {publishedAt && categories.length > 0 ? <span className="text-primary/30">•</span> : null}
            {categories.map((category) => (
              <span
                className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary/70"
                key={category.id}
              >
                {category.title}
              </span>
            ))}
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-primary md:text-5xl">
              {post.title}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-primary/70">{post.excerpt}</p>
          </div>
        </header>

        {featuredImage ? (
          <div className="relative mb-10 aspect-[16/8] overflow-hidden rounded-3xl bg-primary/5">
            <Media
              fill
              htmlElement={null}
              imgClassName="object-cover"
              priority
              resource={featuredImage}
              size="(max-width: 1024px) 100vw, 1024px"
            />
          </div>
        ) : null}

        <RichText className="mx-auto max-w-3xl" data={post.content} />
      </div>

      {relatedPosts.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl border-t border-primary/10 pt-12">
          <div className="mb-8 space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary/55">
              Свързани статии
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-primary">
              Още по темата
            </h2>
          </div>
          <PostArchive posts={relatedPosts} />
        </section>
      ) : null}
    </div>
  )
}
