import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { redirect } from 'next/navigation'

type RecoverPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const toSearchString = (params: Record<string, string | string[] | undefined>) => {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') search.set(key, value)
    else if (Array.isArray(value)) {
      value.forEach((entry) => search.append(key, entry))
    }
  }

  const query = search.toString()

  return query ? `?${query}` : ''
}

export default async function RecoverPasswordPage({
  searchParams,
}: RecoverPasswordPageProps) {
  const params = await searchParams

  redirect(`/forgot-password${toSearchString(params)}`)
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Пренасочване към възстановяване на парола.',
  path: '/recover-password',
  title: 'Забравена парола',
})
