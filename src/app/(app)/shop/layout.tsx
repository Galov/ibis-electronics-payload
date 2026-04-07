import { Categories } from '@/components/layout/search/Categories'
import { ShopBanner } from '@/components/shop/ShopBanner'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { Suspense } from 'react'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config: configPromise })
  const shopPage = await payload.findGlobal({
    slug: 'shopPage',
    depth: 1,
  })

  return (
    <Suspense fallback={null}>
      <div className="container flex flex-col gap-8 my-16 pb-4 ">
        <ShopBanner banner={shopPage?.topBanner} />

        <div className="flex flex-col md:flex-row items-start justify-between gap-10 md:gap-4">
          <div className="w-full flex-none flex flex-col gap-4 basis-1/5">
            <Categories />
          </div>
          <div className="min-h-screen w-full">{children}</div>
        </div>
      </div>
    </Suspense>
  )
}
