import type { ReactNode } from 'react'
import CatalogLayout from '@/components/catalog/CatalogLayout'

export default function MagazinLayout({ children }: { children: ReactNode }) {
  return <CatalogLayout>{children}</CatalogLayout>
}
