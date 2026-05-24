import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{
    slug: string
  }>
}

export default async function LegacyBrandPage({ params }: Props) {
  const { slug } = await params
  const normalizedSlug = decodeURIComponent(slug || '').trim()

  if (!normalizedSlug) {
    redirect('/magazin')
  }

  const qs = new URLSearchParams({
    brand: normalizedSlug,
  })

  redirect(`/magazin?${qs.toString()}`)
}
