import { Categories } from '@/components/layout/search/Categories'
import { ShopBanner } from '@/components/shop/ShopBanner'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config: configPromise })
  const shopPage = await payload.findGlobal({
    slug: 'shopPage',
    depth: 1,
  })

  return (
    <div className="container my-16 flex flex-col gap-8 pb-4">
      <ShopBanner banner={shopPage?.topBanner} priority />

      <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:gap-4">
        <div className="flex w-full basis-1/5 flex-none flex-col gap-4">
          <Categories />
        </div>
        <div className="min-h-screen w-full">{children}</div>
      </div>
    </div>
  )
}
