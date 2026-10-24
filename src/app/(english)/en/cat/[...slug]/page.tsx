import type { Metadata } from 'next'

export { default } from '@/app/(app)/cat/[...slug]/page'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const path = slug.map(encodeURIComponent).join('/')
  return { title: 'Category', alternates: { canonical: `/en/cat/${path}` } }
}
