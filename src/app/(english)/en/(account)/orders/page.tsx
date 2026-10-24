import Page from '@/app/(app)/(account)/orders/page'
export default function EnglishPage() {
  return <Page params={Promise.resolve({ locale: 'en' })} />
}
export const metadata = { title: 'Orders', alternates: { canonical: '/en/orders' } }
