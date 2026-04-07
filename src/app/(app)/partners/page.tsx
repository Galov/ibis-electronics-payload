import configPromise from '@payload-config'
import { generateMeta } from '@/utilities/generateMeta'
import { getPayload } from 'payload'
import React from 'react'

import { PartnersDirectory } from '@/components/partners/PartnersDirectory'

type PartnersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const payload = await getPayload({ config: configPromise })
  const params = await searchParams
  const initialPartnerSlug = typeof params.partner === 'string' ? params.partner : undefined

  const partners = await payload.find({
    collection: 'partners',
    limit: 100,
    pagination: false,
    sort: 'title',
  })

  return (
    <div className="container py-12 md:py-14">
      <div className="mb-10 max-w-3xl">
        <h1 className="text-3xl font-normal text-primary/85">Партньори</h1>
      </div>

      {partners.docs.length > 0 ? (
        <PartnersDirectory initialPartnerSlug={initialPartnerSlug} partners={partners.docs} />
      ) : (
        <div className="max-w-2xl rounded-xl bg-muted/20 px-5 py-6 text-sm leading-7 text-primary/68 md:px-7 md:py-8">
          В момента все още няма добавени партньори. След като бъдат въведени в админ панела, тук
          ще се появят списъкът и картата.
        </div>
      )}
    </div>
  )
}

export async function generateMetadata() {
  return generateMeta({
    doc: { title: 'Партньори' },
    fallbackDescription: 'Открийте партньорските обекти и дистрибутори на Ibis Electronics.',
    fallbackTitle: 'Партньори',
    path: '/partners',
  })
}
