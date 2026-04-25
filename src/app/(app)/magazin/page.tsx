import { CatalogPagination } from '@/components/catalog/CatalogPagination'
import { MobileCatalogControls } from '@/components/catalog/MobileCatalogControls'
import { Grid } from '@/components/Grid'
import { ProductGridItem } from '@/components/ProductGridItem'
import { Search } from '@/components/Search'
import { Categories } from '@/components/layout/search/Categories'
import { SortToolbar } from '@/components/layout/search/SortToolbar'
import { ShopBanner } from '@/components/shop/ShopBanner'
import { generateMeta } from '@/utilities/generateMeta'
import type { Metadata } from 'next'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'
import React from 'react'

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { brand, category, limit, page, q, sort } = await searchParams
  const hasFilters = Boolean(brand || category || limit || page || q || sort)

  const metadata = await generateMeta({
    fallbackDescription: 'Разгледайте продуктите в каталога.',
    fallbackTitle: 'Продукти',
    path: '/magazin',
  })

  return {
    ...metadata,
    robots: {
      follow: true,
      googleBot: {
        follow: true,
        index: !hasFilters,
      },
      index: !hasFilters,
    },
  }
}

export default async function MagazinPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams
  const { brand, category, limit: rawLimit, page: rawPage, q: rawSearchValue, sort } = resolvedSearchParams
  const searchValue = String(rawSearchValue || '').trim()
  const searchTerms = tokenizeSearchTerms(searchValue)
  const pageSize = normalizePageSize(rawLimit)
  const currentPage = pageSize === 'all' ? 1 : normalizePage(rawPage)
  const payload = await getPayload({ config: configPromise })
  const shopPage = await payload.findGlobal({
    slug: 'shopPage',
    depth: 1,
  })
  const selectedBrandID = brand ? await getBrandIDForFilter(payload, String(brand)) : null
  const categoryIDs = category ? await getCategoryIDsForFilter(payload, String(category)) : null
  const searchClauses = searchTerms.length > 0 ? await getSearchClauses(payload, searchTerms) : []

  const products = await payload.find({
    collection: 'products',
    draft: false,
    limit: pageSize === 'all' ? 1000 : pageSize,
    page: currentPage,
    overrideAccess: false,
    select: {
      inventory: true,
      manufacturerCode: true,
      published: true,
      stockQty: true,
      images: true,
      price: true,
      title: true,
      slug: true,
      categories: true,
      brand: true,
      sku: true,
    },
    ...(sort ? { sort } : { sort: '-updatedAt' }),
    where: {
      and: [
        {
          published: {
            equals: true,
          },
        },
        ...searchClauses,
        ...(category
          ? [
              {
                categories: {
                  in: categoryIDs || [String(category)],
                },
              },
            ]
          : []),
        ...(brand
          ? [
              {
                brand: {
                  equals: selectedBrandID || String(brand),
                },
              },
            ]
          : []),
      ],
    },
  })

  const visibleResults = products.docs.length
  const totalResults = products.totalDocs
  const resultsText = totalResults === 1 ? 'резултат' : 'резултата'
  const hasActiveFilters = Boolean(searchValue || category || brand)
  const availableBrands = Array.from(
    new Map(
      products.docs
        .flatMap((product) => {
          if (!product.brand || typeof product.brand === 'string') return []

          return [
            {
              id: product.brand.id,
              slug: product.brand.slug || String(product.brand.id),
              title: product.brand.title,
            },
          ]
        })
        .map((availableBrand) => [availableBrand.slug, availableBrand]),
    ).values(),
  )

  return (
    <div>
      <section className="mb-6 rounded-[6px] bg-[rgb(250,251,253)] px-4 py-5 md:px-5 md:py-6">
        <div className="hidden md:block">
          <Search
            availableBrands={availableBrands}
            showBrandFilter={Boolean(searchValue) && products.docs.length > 0}
          />
        </div>

        {searchValue ? (
          <div className="pt-5">
            <p className="text-sm leading-7 text-[rgb(1,55,186)]">
              {visibleResults === 0
                ? 'Няма продукти, които съвпадат с избраните критерии.'
                : `Показваме ${visibleResults} от ${totalResults} ${resultsText} за избраните критерии.`}
            </p>
          </div>
        ) : null}

        {!hasActiveFilters && products.docs?.length === 0 ? (
          <div className="pt-5">
            <p className="text-sm leading-7 text-primary/62">
              Няма намерени продукти. Опитай с други филтри.
            </p>
          </div>
        ) : null}

        {hasActiveFilters && products.docs?.length === 0 ? (
          <div className="pt-5">
            <p className="text-sm leading-7 text-primary/62">
              Няма намерени продукти по избраната комбинация от филтри.
            </p>
          </div>
        ) : null}

        {products?.docs.length > 0 ? (
          <div className="hidden md:block">
            <SortToolbar pageSize={pageSize} />
          </div>
        ) : null}
      </section>

      <MobileCatalogControls>
        <Search
          availableBrands={availableBrands}
          showBrandFilter={Boolean(searchValue) && products.docs.length > 0}
        />
        <Categories />
        {products?.docs.length > 0 ? <SortToolbar pageSize={pageSize} /> : null}
      </MobileCatalogControls>

      {products?.docs.length > 0 ? (
        <>
          <Grid className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.docs.map((product) => {
              return <ProductGridItem key={product.id} product={product} />
            })}
          </Grid>
          <CatalogPagination
            currentPage={currentPage}
            pathname="/shop"
            searchParams={resolvedSearchParams}
            totalPages={pageSize === 'all' ? 1 : products.totalPages}
          />
          <ShopBanner banner={shopPage?.bottomBanner} className="mt-8" />
        </>
      ) : null}
    </div>
  )
}

const tokenizeSearchTerms = (value: string) =>
  value
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

const normalizePageSize = (value: string | string[] | undefined): number | 'all' => {
  const rawValue = Array.isArray(value) ? value[0] : value

  if (rawValue === 'all') {
    return 'all'
  }

  const allowedValues = new Set([8, 16, 24, 48, 96])
  const numericValue = Number(rawValue)

  if (allowedValues.has(numericValue)) {
    return numericValue
  }

  return 16
}

const normalizePage = (value: string | string[] | undefined): number => {
  const rawValue = Array.isArray(value) ? value[0] : value
  const numericValue = Number(rawValue)

  if (Number.isInteger(numericValue) && numericValue > 0) {
    return numericValue
  }

  return 1
}

const getCategoryIDsForFilter = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  selectedCategoryID: string,
) => {
  const categories = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1000,
    pagination: false,
    select: {
      parent: true,
    },
  })

  const childrenByParentID = new Map<string, string[]>()

  for (const category of categories.docs) {
    if (typeof category.parent !== 'string') continue

    const existingChildren = childrenByParentID.get(category.parent) || []
    existingChildren.push(category.id)
    childrenByParentID.set(category.parent, existingChildren)
  }

  const ids = new Set<string>([selectedCategoryID])
  const queue = [selectedCategoryID]

  while (queue.length > 0) {
    const currentID = queue.shift()

    if (!currentID) continue

    for (const childID of childrenByParentID.get(currentID) || []) {
      if (ids.has(childID)) continue
      ids.add(childID)
      queue.push(childID)
    }
  }

  return [...ids]
}

const getMatchingBrandIDs = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  searchValue: string,
) => {
  const brands = await payload.find({
    collection: 'brands',
    depth: 0,
    limit: 100,
    overrideAccess: false,
    pagination: false,
    where: {
      title: {
        like: searchValue,
      },
    },
  })

  return brands.docs.map((brand) => brand.id)
}

const getBrandIDForFilter = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  rawBrandFilter: string,
) => {
  const trimmedValue = rawBrandFilter.trim()

  if (!trimmedValue) return null

  const bySlug = await payload.find({
    collection: 'brands',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      slug: {
        equals: trimmedValue,
      },
    },
  })

  if (bySlug.docs[0]) return bySlug.docs[0].id

  return trimmedValue
}

const buildSearchConditionsForTerm = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  searchTerm: string,
): Promise<Where[]> => {
  const matchingBrandIDs = await getMatchingBrandIDs(payload, searchTerm)

  return [
    {
      title: {
        like: searchTerm,
      },
    },
    {
      sku: {
        like: searchTerm,
      },
    },
    {
      manufacturerCode: {
        like: searchTerm,
      },
    },
    ...(matchingBrandIDs.length > 0
      ? [
          {
            brand: {
              in: matchingBrandIDs,
            },
          } satisfies Where,
        ]
      : []),
  ]
}

const getSearchClauses = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  searchTerms: string[],
): Promise<Where[]> => {
  const clauses = await Promise.all(
    searchTerms.map(async (searchTerm) => ({
      or: await buildSearchConditionsForTerm(payload, searchTerm),
    })),
  )

  return clauses
}
