import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { RichText } from '@/components/RichText'
import type { ComponentProps } from 'react'
import { ReturnCostNotice } from '@/components/ReturnCostNotice'
import { contentFingerprint } from '@/i18n/content/fingerprint'
import manifest from '@/i18n/content/manifest.json'
import privacy from '@/i18n/content/privacy.en.json'
import terms from '@/i18n/content/terms.en.json'

export async function EnglishLegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const payload = await getPayload({ config })
  const current = await payload.findGlobal({
    slug: kind === 'terms' ? 'terms-page' : 'privacy-page',
    depth: 0,
  })
  const ready = contentFingerprint(current.content) === manifest[kind].sourceHash
  return (
    <article className="container py-14">
      <div className="mx-auto max-w-4xl space-y-6 leading-7 text-primary/75">
        <h1 className="type-page-title">
          {kind === 'terms' ? 'Terms and Conditions' : 'Privacy Policy'}
        </h1>
        <p className="text-sm text-primary/60">
          English translation of the current Bulgarian document.{' '}
          <Link className="underline" href={`/${kind}`}>
            Read the Bulgarian version
          </Link>
          .
        </p>
        {!ready ? (
          <p role="status">
            The Bulgarian document has changed. Its English translation is being updated. Please use
            the current Bulgarian version linked above.
          </p>
        ) : kind === 'privacy' ? (
          <RichText
            data={privacy as unknown as ComponentProps<typeof RichText>['data']}
            enableGutter={false}
            className="max-w-none"
          />
        ) : (
          terms.map((paragraph, index) => (
            <p className="whitespace-pre-line" key={index}>
              {paragraph}
            </p>
          ))
        )}
        {kind === 'terms' ? (
          <section id="return-costs" className="space-y-3 border-t pt-6">
            <h2 className="type-section-title">Return costs when withdrawing from a purchase</h2>
            <ReturnCostNotice />
            <Link className="underline" href="/en/otkaz-porachka">
              Order withdrawal form
            </Link>
          </section>
        ) : null}
      </div>
    </article>
  )
}
