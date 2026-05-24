import { ProductGridItem } from '@/components/ProductGridItem'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import React from 'react'

import { buildCategoryPath, buildCategoryPublicSegments } from '@/utilities/category'
import { buildBreadcrumbSchema, buildCategoryBreadcrumbItems } from '@/utilities/schema'

type Args = {
  params: Promise<{
    slug: string[]
  }>
}

type CategoryPageData = {
  id: string
  meta?: {
    description?: string | null
    image?: { url?: string | null } | null
    title?: string | null
  } | null
  parent?:
    | {
        parent?: CategoryPageData['parent']
        slug?: string | null
        title?: string | null
      }
    | string
    | null
  slug?: string | null
  title: string
}

export async function generateMetadata({ params }: Args) {
  const { slug } = await params
  const category = await queryCategoryBySegments({ segments: slug })

  if (!category) return notFound()

  return generateMeta({
    doc: category,
    fallbackDescription: `Продукти в категория ${category.title} от Ibis Electronics.`,
    fallbackTitle: category.title,
    path: buildCategoryPath(category),
  })
}

export default async function CategoryPage({ params }: Args) {
  const { slug } = await params
  const category = await queryCategoryBySegments({ segments: slug })

  if (!category) return notFound()

  const products = await queryProductsByCategoryID({ categoryID: category.id })
  const categoryTrail = buildCategoryTrail(category)
  const breadcrumbJsonLd = buildBreadcrumbSchema(buildCategoryBreadcrumbItems({ category }))

  return (
    <div className="container py-10 md:py-12">
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
        type="application/ld+json"
      />
      <div className="mb-5">
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary/55">
          <Link className="transition hover:text-primary/80" href="/magazin">
            Каталог
          </Link>
          {categoryTrail.map((item) => (
            <React.Fragment key={item.path}>
              <span>/</span>
              <Link className="transition hover:text-primary/80" href={item.path}>
                {item.title}
              </Link>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="mb-8 max-w-3xl">
        <h1 className="type-page-title text-primary">{category.title}</h1>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {products.map((product) => (
            <ProductGridItem key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-muted/20 px-5 py-6 text-sm leading-7 text-primary/65 md:px-6 md:py-7">
          В тази категория все още няма публикувани продукти.
        </div>
      )}
    </div>
  )
}

const buildCategoryTrail = (category: CategoryPageData) => {
  const chain = []
  let current: CategoryPageData | null = category

  while (current) {
    chain.unshift(current)
    current = current.parent && typeof current.parent !== 'string' ? (current.parent as CategoryPageData) : null
  }

  return chain.map((item) => ({
    path: buildCategoryPath(item),
    title: item.title,
  }))
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

  const category =
    (result.docs as CategoryPageData[]).find((doc) => {
      const actualSegments = buildCategoryPublicSegments(doc)

      return actualSegments.join('/') === requestedSegments.join('/')
    }) || null

  return category
}

const queryProductsByCategoryID = async ({ categoryID }: { categoryID: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'products',
    depth: 1,
    draft: false,
    limit: 48,
    overrideAccess: false,
    pagination: false,
    select: {
      categories: true,
      images: true,
      inventory: true,
      manufacturerCode: true,
      price: true,
      published: true,
      slug: true,
      sku: true,
      stockQty: true,
      title: true,
    },
    sort: 'title',
    where: {
      and: [
        {
          published: {
            equals: true,
          },
        },
        {
          categories: {
            in: [categoryID],
          },
        },
      ],
    },
  })

  return result.docs
}
