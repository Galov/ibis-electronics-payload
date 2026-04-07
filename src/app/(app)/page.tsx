import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/shop')
}

export const dynamic = 'force-dynamic'
