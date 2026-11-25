import Directory from '@/app/(app)/kategorii/page'
export default function EnglishCategories() {
  return <Directory params={Promise.resolve({ locale: 'en' })} />
}
export const metadata = { title: 'Product categories', alternates: { canonical: '/en/kategorii' } }
