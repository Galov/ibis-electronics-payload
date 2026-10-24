import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RenderHero } from '@/heros/RenderHero'
import { RenderBlocks } from '@/blocks/RenderBlocks'
import { translateInfoPage } from '@/i18n/content/translatePage'

export async function EnglishInfoPage({ slug }: { slug: 'za-nas' | 'uslugi' | 'serviz' }) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    draft: false,
    overrideAccess: false,
  })
  const source = docs[0]
  if (!source) notFound()
  const { page, complete } = translateInfoPage({
    title: source.title,
    hero: source.hero,
    layout: source.layout,
  })
  if (!complete)
    return (
      <section className="container py-14">
        <h1 className="type-page-title">English translation is being updated</h1>
        <p className="mt-6">
          The source content has changed.{' '}
          <Link href={`/${slug}`} className="underline">
            Read the current Bulgarian page
          </Link>
          .
        </p>
      </section>
    )
  return (
    <>
      <RenderHero {...(page.hero || {})} />
      <div className="pb-16">
        <RenderBlocks blocks={page.layout || []} />
      </div>
    </>
  )
}
