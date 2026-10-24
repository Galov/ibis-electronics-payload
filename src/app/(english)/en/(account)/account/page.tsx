import Page from '@/app/(app)/(account)/account/page'
export default function EnglishPage() {
  return <Page params={Promise.resolve({ locale: 'en' })} />
}
export const metadata = { title: 'Account settings', alternates: { canonical: '/en/account' } }
