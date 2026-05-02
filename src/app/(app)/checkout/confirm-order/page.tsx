import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { RevolutConfirmOrder } from '@/components/checkout/RevolutConfirmOrder'

export default function ConfirmOrderPage() {
  return <RevolutConfirmOrder />
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Потвърждение на поръчка.',
  path: '/checkout/confirm-order',
  title: 'Потвърждаване на поръчка',
})
