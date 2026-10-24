import { permanentRedirect } from 'next/navigation'

// Also preserve filters if this route is rendered outside Next's central redirect layer.
export default async function LegacyEnglishCatalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value)
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry))
  }
  permanentRedirect(`/en${query.size ? `?${query}` : ''}`)
}
