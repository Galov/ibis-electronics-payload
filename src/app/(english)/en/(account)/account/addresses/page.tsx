import Page from '@/app/(app)/(account)/account/addresses/page'
export default function EnglishPage() {
  return <Page params={Promise.resolve({ locale: 'en' })} />
}
export const metadata = { title: 'Addresses', alternates: { canonical: '/en/account/addresses' } }
