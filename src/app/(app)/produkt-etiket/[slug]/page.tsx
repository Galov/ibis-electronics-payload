import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{
    slug: string
  }>
}

export default async function LegacyProductTagPage({ params }: Props) {
  const { slug } = await params
  const normalizedSearchTerm = decodeURIComponent(slug || '')
    .replace(/-/g, ' ')
    .trim()

  if (!normalizedSearchTerm) {
    redirect('/')
  }

  const qs = new URLSearchParams({
    q: normalizedSearchTerm,
  })

  redirect(`/magazin?${qs.toString()}`)
}
