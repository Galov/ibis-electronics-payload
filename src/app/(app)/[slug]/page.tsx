import configPromise from '@payload-config'
import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import type { Page } from '@/payload-types'
import { generateMeta } from '@/utilities/generateMeta'
import { getPayload } from 'payload'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params

  if (!slug) return {}

  const page = await queryPageBySlug(slug)

  if (!page) return {}

  return generateMeta({
    doc: page,
    fallbackTitle: page.title || undefined,
    path: `/${slug}`,
  })
}

export default async function Page({ params }: Args) {
  const { slug } = await params

  if (!slug) return notFound()

  const page = await queryPageBySlug(slug)

  if (!page) return notFound()

  return (
    <React.Fragment>
      <RenderHero {...(page.hero || {})} />
      <div className="pb-16">
        <RenderBlocks blocks={page.layout || []} />
      </div>
    </React.Fragment>
  )
}

const queryPageBySlug = async (slug: string): Promise<Page | null> => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    depth: 2,
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return (result.docs?.[0] as unknown as Page | undefined) || null
}
