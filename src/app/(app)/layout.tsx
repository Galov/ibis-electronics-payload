import type { ReactNode } from 'react'
import StorefrontLayout from '@/components/layout/StorefrontLayout'

export { metadata } from '@/components/layout/StorefrontLayout'
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: ReactNode }) {
  return <StorefrontLayout>{children}</StorefrontLayout>
}
