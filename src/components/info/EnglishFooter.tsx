import Link from 'next/link'
import { OpenCookiePreferencesButton } from '@/components/CookieConsent/OpenPreferencesButton'

export function EnglishFooter({ analyticsEnabled }: { analyticsEnabled: boolean }) {
  return (
    <footer className="container border-t py-8 text-sm text-primary/65">
      <nav aria-label="Information" className="mb-5 flex flex-wrap gap-x-6 gap-y-3">
        <Link href="/en/za-nas">About us</Link>
        <Link href="/en/uslugi">Services</Link>
        <Link href="/en/serviz">Repair centre</Link>
        <Link href="/en/kontakti">Contact us</Link>
        <Link href="/en/terms">Terms and Conditions</Link>
        <Link href="/en/privacy">Privacy Policy</Link>
        <Link href="/en/otkaz-porachka">Order withdrawal</Link>
      </nav>
      <p>© Ibis Electronics</p>
      {analyticsEnabled ? <OpenCookiePreferencesButton className="mt-4 underline" /> : null}
    </footer>
  )
}
