import Page from '@/app/(app)/login/page'
export default function EnglishPage() {
  return <Page params={Promise.resolve({ locale: 'en' })} />
}
export const metadata = { title: 'Sign in', alternates: { canonical: '/en/login' } }
