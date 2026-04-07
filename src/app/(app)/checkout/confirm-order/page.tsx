import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { redirect } from 'next/navigation'

export default function ConfirmOrderPage() {
  redirect('/checkout')
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Потвърждение на поръчка.',
  path: '/checkout/confirm-order',
  title: 'Потвърждаване на поръчка',
})
