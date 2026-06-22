import configPromise from '@payload-config'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import React from 'react'

import { buildCategoryPath } from '@/utilities/category'
import { generateMeta } from '@/utilities/generateMeta'

export const dynamic = 'force-dynamic'

type CategoryNode = {
  children: CategoryNode[]
  directProductCount: number
  id: string
  parent: CategoryNode | null
  productCount: number
  slug: string
  title: string
}

type CategoryDoc = {
  id: string
  parent?: null | string
  productCount?: null | number
  slug?: null | string
  title: string
}

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    fallbackDescription:
      'Разгледайте всички продуктови категории в каталога на Ibis Electronics и стигнете бързо до точната група продукти.',
    fallbackTitle: 'Продуктови категории',
    path: '/kategorii',
  })
}

const formatCount = (value: number) => new Intl.NumberFormat('bg-BG').format(value)

const renderCategoryBranch = (category: CategoryNode, level = 0): React.ReactNode => {
  const isTopLevel = level === 0
  const isSecondLevel = level === 1

  return (
    <li key={category.id} className={level > 0 ? 'pt-1' : ''}>
      <Link
        className={[
          'inline-flex items-baseline gap-1.5 transition hover:text-[rgb(0,46,158)]',
          isTopLevel
            ? 'text-[17px] font-normal tracking-tight text-[rgb(1,55,186)] hover:font-medium'
            : isSecondLevel
              ? 'text-[14px] font-normal text-primary/78'
              : 'text-[13px] leading-[1.35] text-primary/62',
        ].join(' ')}
        href={buildCategoryPath(category)}
      >
        <span>{category.title}</span>
        <span className="text-[11px] font-normal text-primary/38">
          ({formatCount(category.productCount)})
        </span>
      </Link>

      {isTopLevel ? <div className="mt-3 border-t border-[rgb(1,55,186)]/10 pt-3" /> : null}

      {category.children.length > 0 ? (
        <ul
          className={
            isTopLevel
              ? 'space-y-1 list-none'
              : 'mt-1 space-y-0.5 list-none pl-3'
          }
        >
          {category.children.map((child) => renderCategoryBranch(child, level + 1))}
        </ul>
      ) : null}
    </li>
  )
}

const buildCategoryTree = (docs: CategoryDoc[]) => {
  const nodes = new Map<string, CategoryNode>()
  const rootNodes: CategoryNode[] = []

  for (const category of docs) {
    if (!category.slug) continue

    nodes.set(category.id, {
      children: [],
      directProductCount: category.productCount ?? 0,
      id: category.id,
      parent: null,
      productCount: category.productCount ?? 0,
      slug: category.slug,
      title: category.title,
    })
  }

  for (const category of docs) {
    const node = nodes.get(category.id)

    if (!node) continue

    const parentID = typeof category.parent === 'string' ? category.parent : null
    const parentNode = parentID ? nodes.get(parentID) || null : null

    node.parent = parentNode

    if (!parentNode) {
      rootNodes.push(node)
      continue
    }

    parentNode.children.push(node)
  }

  const sortTree = (treeNodes: CategoryNode[]) => {
    treeNodes.sort((a, b) => a.title.localeCompare(b.title, 'bg'))
    for (const node of treeNodes) {
      sortTree(node.children)
    }
  }

  const aggregateProductCounts = (treeNodes: CategoryNode[]) => {
    for (const node of treeNodes) {
      aggregateProductCounts(node.children)
      node.productCount =
        node.directProductCount +
        node.children.reduce((total, child) => total + child.productCount, 0)
    }
  }

  sortTree(rootNodes)
  aggregateProductCounts(rootNodes)

  return rootNodes
}

export default async function CategoriesDirectoryPage() {
  const payload = await getPayload({ config: configPromise })
  const categoriesResult = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1000,
    pagination: false,
    select: {
      parent: true,
      productCount: true,
      slug: true,
      title: true,
    },
    sort: 'title',
  })

  const rootCategories = buildCategoryTree(categoriesResult.docs as CategoryDoc[])

  return (
    <div className="container py-12 md:py-16">
      <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
        <h1 className="text-[36px] leading-[43px] font-normal text-[rgb(1,55,186)]">
          Продуктови категории
        </h1>
        <p className="text-base leading-7 text-primary/70 md:text-lg">
          Разгледайте всички категории в каталога и отворете директно страницата на нужната
          продуктова група.
        </p>
      </div>

      {rootCategories.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rootCategories.map((category) => (
            <section
              className="rounded-[10px] border border-transparent bg-white px-5 py-5 shadow-[0_6px_14px_rgba(15,23,42,0.04)] transition duration-300 ease-out hover:border-black/5 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]"
              key={category.id}
            >
              <ul className="list-none">
                {renderCategoryBranch(category)}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-2xl rounded-xl bg-muted/20 px-5 py-6 text-sm leading-7 text-primary/68 md:px-7 md:py-8">
          В момента все още няма добавени продуктови категории.
        </div>
      )}
    </div>
  )
}
