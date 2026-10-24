import Page from '@/app/(app)/create-account/page'
export default function EnglishPage() {
  return <Page params={Promise.resolve({ locale: 'en' })} />
}
export const metadata = { title: 'Create account', alternates: { canonical: '/en/create-account' } }
