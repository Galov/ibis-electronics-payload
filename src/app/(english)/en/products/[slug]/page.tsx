import type { Metadata } from 'next'

import ProductPage, {
  generateMetadata as generateProductMetadata,
} from '@/app/(app)/products/[slug]/page'

export default async function EnglishProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const resolved = await params
  return <ProductPage params={Promise.resolve({ ...resolved, locale: 'en' })} />
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const resolved = await params
  return generateProductMetadata({ params: Promise.resolve({ ...resolved, locale: 'en' }) })
}
