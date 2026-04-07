import clsx from 'clsx'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { Suspense } from 'react'

import { BrandList } from './Brands.client'

async function BrandsContent() {
  const payload = await getPayload({ config: configPromise })

  const brands = await payload.find({
    collection: 'brands',
    depth: 0,
    limit: 1000,
    pagination: false,
    select: {
      productCount: true,
      title: true,
    },
    sort: 'title',
  })

  return <BrandList brands={brands.docs} />
}

const skeleton = 'mb-3 h-4 w-5/6 animate-pulse rounded'
const activeAndTitles = 'bg-neutral-800 dark:bg-neutral-300'
const items = 'bg-neutral-400 dark:bg-neutral-700'

export function Brands() {
  return (
    <Suspense
      fallback={
        <div className="hidden w-full flex-none py-4 lg:block">
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
        </div>
      }
    >
      <BrandsContent />
    </Suspense>
  )
}
