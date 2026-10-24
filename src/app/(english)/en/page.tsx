import type { Metadata } from 'next'
import { MagazinPageContent as CatalogPage } from '@/components/catalog/CatalogPage'
import CatalogLayout from '@/app/(app)/magazin/layout'

export const metadata: Metadata = { title: 'Products', alternates: { canonical: '/en' } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function EnglishCatalog({ searchParams }: Props) {
  return (
    <CatalogLayout>
      <CatalogPage searchParams={searchParams} locale="en" />
    </CatalogLayout>
  )
}
