import { redirect } from 'next/navigation'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ShopRedirectPage({ searchParams }: Props) {
  const params = await searchParams
  const qs = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined) qs.append(key, entry)
      })
      continue
    }

    if (value !== undefined) {
      qs.set(key, value)
    }
  }

  redirect(`/magazin${qs.toString() ? `?${qs.toString()}` : ''}`)
}
