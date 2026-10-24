import type { Metadata } from 'next'
import Link from 'next/link'
import { messages } from '@/i18n/messages'

export const metadata: Metadata = {
  title: 'Electronic components and equipment',
  alternates: { canonical: '/en' },
}

export default function EnglishHome() {
  return (
    <section className="container py-16">
      <h1 className="type-page-title">{messages.en.welcome}</h1>
      <Link className="mt-8 inline-block underline underline-offset-4" href="/en/magazin">
        {messages.en.browse}
      </Link>
    </section>
  )
}
