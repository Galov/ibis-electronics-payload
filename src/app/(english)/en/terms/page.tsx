import { EnglishLegalPage } from '@/components/info/EnglishLegalPage'
export const metadata = { title: 'Terms and Conditions', alternates: { canonical: '/en/terms' } }
export default function Page() {
  return <EnglishLegalPage kind="terms" />
}
