import configPromise from '@payload-config'
import { ContactLocations } from '@/components/contact/ContactLocations'
import { ContactForm } from '@/components/forms/ContactForm'
import { IBIS_CONTACT_LOCATION, IBIS_CONTACT_LOCATION_LABEL } from '@/constants/contact'
import { generateMeta } from '@/utilities/generateMeta'
import { buildLocalBusinessSchemas } from '@/utilities/schema'
import { getPayload } from 'payload'
import React from 'react'

type ContactPageData = {
  meta?: {
    description?: string | null
    image?: { url?: string | null } | null
    title?: string | null
  } | null
  store?: {
    address: string
    phone: string
    workingHours: string
  }
  title?: string
}

export async function generateMetadata() {
  const payload = await getPayload({ config: configPromise })
  const contactPage = (await payload.findGlobal({
    slug: 'contact-page' as never,
    depth: 1,
  })) as ContactPageData

  return generateMeta({
    doc: contactPage,
    fallbackDescription: 'Контакти с Ibis Electronics, магазин, склад и форма за запитвания.',
    fallbackTitle: contactPage.title || 'Контакти',
    path: '/kontakti',
  })
}

export default async function KontaktiPage() {
  const payload = await getPayload({ config: configPromise })
  const contactPage = (await payload.findGlobal({
    slug: 'contact-page' as never,
  })) as ContactPageData

  const localBusinessJsonLd = buildLocalBusinessSchemas(contactPage)
  const location = {
    address: IBIS_CONTACT_LOCATION.address,
    label: IBIS_CONTACT_LOCATION_LABEL,
    phone: contactPage.store?.phone,
    workingHours: contactPage.store?.workingHours,
  }

  return (
    <div className="container py-12 md:py-14">
      {localBusinessJsonLd.map((schema, index) => (
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema),
          }}
          key={index}
          type="application/ld+json"
        />
      ))}
      <div className="mb-10 max-w-3xl">
        <h1 className="text-3xl font-normal text-primary/85">
          {contactPage.title || 'Контакти'}
        </h1>
      </div>

      <div className="space-y-12">
        <ContactLocations location={location} />

        <section className="rounded-xl bg-muted/20 px-5 py-6 md:px-7 md:py-8">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-3xl font-normal text-primary/85">Изпрати запитване</h2>
            <p className="mt-3 text-sm leading-7 text-primary/65">
              Използвай формата по-долу, ако искаш да се свържем с теб за продукт, наличност или
              общо запитване.
            </p>
          </div>

          <ContactForm />
        </section>
      </div>
    </div>
  )
}
