import type { Media, Post, PostCategory } from '@/payload-types'

import Link from 'next/link'
import React from 'react'

import { Media as MediaRenderer } from '@/components/Media'

type PopulatedPostCategory = PostCategory

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
    (category): category is PopulatedPostCategory =>
      Boolean(category && typeof category !== 'string' && category.title && category.slug),
  )

const getFeaturedImage = (post: Post) =>
  post.featuredImage && typeof post.featuredImage === 'object'
    ? (post.featuredImage as Media)
    : undefined

export const PostCard: React.FC<{
  post: Post
}> = ({ post }) => {
  const href = `/blog/${post.slug}`
  const categories = getCategories(post.categories)
  const featuredImage = getFeaturedImage(post)
  const publishedAt = formatDate(post.publishedAt)

  return (
    <article className="overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link className="block" href={href}>
        <div className="relative aspect-[16/10] overflow-hidden bg-primary/5">
          {featuredImage ? (
            <MediaRenderer
              fill
              htmlElement={null}
              imgClassName="object-cover"
              priority={false}
              resource={featuredImage}
              size="(max-width: 1024px) 100vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-primary/45">
              Няма основно изображение
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-primary/55">
          {publishedAt ? <time dateTime={post.publishedAt || undefined}>{publishedAt}</time> : null}
          {categories.length > 0 ? <span className="text-primary/30">•</span> : null}
          {categories.map((category) => (
            <span
              className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary/70"
              key={category.id}
            >
              {category.title}
            </span>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold leading-tight text-primary">
            <Link className="transition hover:text-primary/80" href={href}>
              {post.title}
            </Link>
          </h2>
          <p className="text-sm leading-6 text-primary/70">{post.excerpt}</p>
        </div>

        <Link className="inline-flex text-sm font-medium text-primary transition hover:text-primary/75" href={href}>
          Прочети статията
        </Link>
      </div>
    </article>
  )
}
