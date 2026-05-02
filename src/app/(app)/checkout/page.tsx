import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { CheckoutPage } from '@/components/checkout/CheckoutPage'
import { isRevolutConfigured } from '@/ecommerce/revolutApi'
import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { getPayload } from 'payload'
import React from 'react'

export default async function Checkout() {
  const payload = await getPayload({ config: configPromise })
  const orderSettings = await payload.findGlobal({
    slug: 'order-settings',
    depth: 0,
    overrideAccess: true,
  })
  const freeShippingThreshold =
    typeof orderSettings.freeShippingThreshold === 'number' ? orderSettings.freeShippingThreshold : undefined
  const revolutPayEnabled = Boolean(orderSettings.revolutPayEnabled && isRevolutConfigured())

  return (
    <div className="container min-h-[90vh] flex">
      <h1 className="sr-only">Поръчка</h1>

      <CheckoutPage
        freeShippingThreshold={freeShippingThreshold}
        revolutPayEnabled={revolutPayEnabled}
      />
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Поръчка.',
  path: '/checkout',
  title: 'Поръчка',
})
