import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import React from 'react'
import { FindOrderForm } from '@/components/forms/FindOrderForm'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'

export default async function FindOrderPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  return (
    <div className="container py-16">
      <FindOrderForm initialEmail={user?.email} />
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Намерете поръчката си чрез имейл и номер на поръчка.',
  path: '/find-order',
  title: 'Намери поръчка',
})
