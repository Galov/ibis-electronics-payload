import { Gallery } from '@/components/product/Gallery'
import { ProductDescription } from '@/components/product/ProductDescription'
import { RelatedProducts } from '@/components/product/RelatedProducts'
import { RecentlyViewedProducts } from '@/components/product/RecentlyViewedProducts'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { getProductPrimaryImage, getProductSEODescription } from '@/utilities/product'
import { generateMeta } from '@/utilities/generateMeta'
import { buildCategoryPath } from '@/utilities/category'
import { buildBreadcrumbSchema, buildProductBreadcrumbItems, buildProductSchema } from '@/utilities/schema'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  const primaryImage = getProductPrimaryImage(product)
  const metadata = await generateMeta({
    doc: {
      ...(product as object),
      meta:
        (product as { meta?: unknown }).meta ||
        (primaryImage?.url
          ? {
              image: {
                alt: primaryImage.alt,
                url: primaryImage.url,
              },
            }
          : undefined),
    },
    fallbackDescription: getProductSEODescription(product),
    fallbackTitle: product.title,
    path: `/products/${slug}`,
  })

  return {
    ...metadata,
    robots: {
      follow: true,
      googleBot: {
        follow: true,
        index: true,
      },
      index: true,
    },
  }
}

export default async function ProductPage({ params }: Args) {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  const primaryCategory =
    product.categories?.find(
      (category): category is Exclude<(typeof product.categories)[number], string> =>
        Boolean(category && typeof category !== 'string' && category.slug && category.title),
    ) || null
  const parentCategory =
    primaryCategory?.parent && typeof primaryCategory.parent !== 'string' ? primaryCategory.parent : null

  const relatedProducts = await queryRelatedProducts({
    categoryIDs:
      product.categories
        ?.map((category) => (category && typeof category !== 'string' ? category.id : category))
        .filter(Boolean) || [],
    productID: product.id,
  })

  const productJsonLd = {
    ...buildProductSchema({
      brand: product.brand && typeof product.brand !== 'string' ? product.brand.title : null,
      category: primaryCategory,
      description: getProductSEODescription(product),
      image: getProductPrimaryImage(product)?.url,
      inStock: (product.inventory || 0) > 0,
      name: product.title,
      price: product.price,
      sku: product.sku,
      slug,
    }),
  }
  const breadcrumbJsonLd = buildBreadcrumbSchema(
    buildProductBreadcrumbItems({
      category: primaryCategory,
      productName: product.title,
      productSlug: slug,
    }),
  )

  return (
    <React.Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
        type="application/ld+json"
      />
      <div className="container pt-8 pb-8">
        <div className="mb-3">
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary/55">
            <Link className="transition hover:text-primary/80" href="/shop">
              Каталог
            </Link>
            {parentCategory?.slug && parentCategory?.title ? (
              <>
                <span>/</span>
                <Link
                  className="transition hover:text-primary/80"
                  href={buildCategoryPath(parentCategory)}
                >
                  {parentCategory.title}
                </Link>
              </>
            ) : null}
            {primaryCategory?.slug && primaryCategory?.title ? (
              <>
                <span>/</span>
                <Link
                  className="transition hover:text-primary/80"
                  href={buildCategoryPath(primaryCategory)}
                >
                  {primaryCategory.title}
                </Link>
              </>
            ) : null}
            <span>/</span>
            <span className="text-primary/80">{product.title}</span>
          </nav>
        </div>
        <div className="flex flex-col gap-12 py-4 lg:flex-row lg:gap-10">
          <div className="h-full w-full basis-full lg:basis-1/2">
            <Suspense
              fallback={
                <div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden" />
              }
            >
              {product.images && product.images.length > 0 ? (
                <Gallery gallery={product.images} productTitle={product.title} />
              ) : null}
            </Suspense>
          </div>

          <div className="basis-full lg:basis-1/2">
            <ProductDescription product={product} />
          </div>
        </div>

        <RecentlyViewedProducts
          product={{
            categories: product.categories,
            id: product.id,
            images: product.images,
            inventory: product.inventory,
            manufacturerCode: product.manufacturerCode,
            price: product.price,
            published: product.published,
            slug: product.slug,
            sku: product.sku,
            stockQty: product.stockQty,
            title: product.title,
          }}
        />

        <RelatedProducts products={relatedProducts} />
      </div>
    </React.Fragment>
  )
}

const queryProductBySlug = async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'products',
    depth: 2,
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          published: {
            equals: true,
          },
        },
      ],
    },
  })

  return result.docs?.[0] || null
}

const queryRelatedProducts = async ({
  categoryIDs,
  productID,
}: {
  categoryIDs: string[]
  productID: string
}) => {
  if (categoryIDs.length === 0) return []

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'products',
    depth: 1,
    draft: false,
    limit: 5,
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
    sort: '-updatedAt',
    where: {
      and: [
        {
          published: {
            equals: true,
          },
        },
        {
          id: {
            not_equals: productID,
          },
        },
        {
          categories: {
            in: categoryIDs,
          },
        },
      ],
    },
  })

  return result.docs
}
