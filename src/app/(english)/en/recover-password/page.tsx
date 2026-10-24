import { redirect } from 'next/navigation'
export default async function RecoverPassword({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const values = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') query.set(key, value)
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry))
  }
  redirect(`/en/forgot-password${query.size ? `?${query}` : ''}`)
}
