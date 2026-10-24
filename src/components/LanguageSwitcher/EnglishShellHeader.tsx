import { Cart } from '@/components/Cart'
import Link from 'next/link'
import { Suspense } from 'react'
import { SiteLogo } from '@/components/Logo/SiteLogo'
import { messages } from '@/i18n/messages'
import { LanguageSwitcher } from './index'

export function EnglishShellHeader() {
  return (
    <header className="border-b border-primary/10">
      <div className="container flex flex-wrap items-center justify-between gap-6 py-6">
        <Link href="/en" aria-label="Ibis Electronics — Home">
          <SiteLogo priority />
        </Link>
        <nav aria-label="Main navigation" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          <Link href="/en/magazin">{messages.en.catalog}</Link>
          <Link href="/en/uslugi">Services</Link>
          <Link href="/en/kontakti">Contact us</Link>
          <Link href="/en/account">Account</Link>
        </nav>
        <Suspense fallback={null}>
          <LanguageSwitcher />
          <Cart />
        </Suspense>
      </div>
      <p className="container pb-4 text-sm text-primary/60" role="status">
        {messages.en.preview}
      </p>
    </header>
  )
}
