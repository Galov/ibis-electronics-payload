import { RichText } from '@/components/RichText'
import configPromise from '@payload-config'
import { generateMeta } from '@/utilities/generateMeta'
import { getPayload } from 'payload'

type PrivacyPageData = {
  content?: any
  meta?: {
    description?: string | null
    image?: { url?: string | null } | null
    title?: string | null
  } | null
  title: string
}

export async function generateMetadata() {
  const payload = await getPayload({ config: configPromise })
  const page = (await payload.findGlobal({
    slug: 'privacy-page',
    depth: 1,
  })) as PrivacyPageData

  return generateMeta({
    doc: page,
    fallbackDescription: 'Политика за поверителност на сайта на Ibis Electronics.',
    fallbackTitle: page.title || 'Политика за поверителност',
    path: '/privacy',
  })
}

export default async function PrivacyPage() {
  const payload = await getPayload({ config: configPromise })
  const page = (await payload.findGlobal({
    slug: 'privacy-page',
    depth: 0,
  })) as PrivacyPageData

  return (
    <div className="container py-14">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-light text-primary/75">{page.title}</h1>
        {page.content ? (
          <RichText
            className="max-w-none font-light text-primary/70 [&_*]:text-primary/70"
            data={page.content}
            enableGutter={false}
          />
        ) : null}
      </div>
    </div>
  )
}
