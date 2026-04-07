import configPromise from '@payload-config'
import { getPayload } from 'payload'
import clsx from 'clsx'
import React, { Suspense } from 'react'

import { CategoriesPanel } from './Categories.client'

type CategoryNode = {
  id: string
  productCount?: number | null
  title: string
  children: CategoryNode[]
}

async function CategoryList() {
  const payload = await getPayload({ config: configPromise })

  const categories = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1000,
    pagination: false,
    select: {
      parent: true,
      productCount: true,
      title: true,
    },
    sort: 'title',
  })

  const nodes = new Map<string, CategoryNode>()
  const rootNodes: CategoryNode[] = []

  for (const category of categories.docs) {
    nodes.set(category.id, {
      children: [],
      id: category.id,
      productCount: category.productCount,
      title: category.title,
    })
  }

  for (const category of categories.docs) {
    const node = nodes.get(category.id)

    if (!node) continue

    const parentID = typeof category.parent === 'string' ? category.parent : null

    if (!parentID) {
      rootNodes.push(node)
      continue
    }

    const parentNode = nodes.get(parentID)

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

  sortTree(rootNodes)

  return <CategoriesPanel categories={rootNodes} />
}

const skeleton = 'mb-3 h-4 w-5/6 animate-pulse rounded'
const activeAndTitles = 'bg-neutral-800 dark:bg-neutral-300'
const items = 'bg-neutral-400 dark:bg-neutral-700'

export function Categories() {
  return (
    <Suspense
      fallback={
        <div className="col-span-2 hidden h-[400px] w-full flex-none py-4 lg:block">
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
        </div>
      }
    >
      <CategoryList />
    </Suspense>
  )
}
