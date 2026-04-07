import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import React from 'react'

import { CheckoutPage } from '@/components/checkout/CheckoutPage'

export default function Checkout() {
  return (
    <div className="container min-h-[90vh] flex">
      <h1 className="sr-only">Поръчка</h1>

      <CheckoutPage />
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Поръчка.',
  path: '/checkout',
  title: 'Поръчка',
})
