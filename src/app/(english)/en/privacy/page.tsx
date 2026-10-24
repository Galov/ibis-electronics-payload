import { EnglishLegalPage } from '@/components/info/EnglishLegalPage'
export const metadata = { title: 'Privacy Policy', alternates: { canonical: '/en/privacy' } }
export default function Page() {
  return <EnglishLegalPage kind="privacy" />
}
