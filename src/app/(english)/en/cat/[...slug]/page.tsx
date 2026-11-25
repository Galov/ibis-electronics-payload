import type { Metadata } from 'next'

import CategoryPage from '@/app/(app)/cat/[...slug]/page'
export default async function EnglishCategory({ params }: { params: Promise<{ slug: string[] }> }) {
  const resolved = await params
  return <CategoryPage params={Promise.resolve({ ...resolved, locale: 'en' })} />
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const path = slug.map(encodeURIComponent).join('/')
  return { title: 'Category', alternates: { canonical: `/en/cat/${path}` } }
}
