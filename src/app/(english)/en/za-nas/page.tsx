import { EnglishInfoPage } from '@/components/info/EnglishInfoPage'
export const metadata = { title: 'About us', alternates: { canonical: '/en/za-nas' } }
export default function Page() {
  return <EnglishInfoPage slug="za-nas" />
}
