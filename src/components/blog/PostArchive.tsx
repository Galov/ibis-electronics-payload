import type { Post } from '@/payload-types'

import React from 'react'

import { PostCard } from './PostCard'

export const PostArchive: React.FC<{
  posts: Post[]
}> = ({ posts }) => {
  if (posts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-primary/15 bg-primary/2 px-6 py-12 text-center text-primary/60">
        Все още няма публикувани статии.
      </div>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
