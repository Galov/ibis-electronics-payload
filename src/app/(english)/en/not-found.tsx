import Link from 'next/link'
import { messages } from '@/i18n/messages'

export default function EnglishNotFound() {
  return (
    <section className="container py-16">
      <h1 className="type-page-title">{messages.en.notFound}</h1>
      <Link href="/en" className="mt-8 inline-block underline">
        {messages.en.home}
      </Link>
    </section>
  )
}
