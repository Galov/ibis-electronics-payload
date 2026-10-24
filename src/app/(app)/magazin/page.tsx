export { generateMetadata } from '@/components/catalog/CatalogPage'

import { MagazinPageContent } from '@/components/catalog/CatalogPage'

export default async function MagazinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <MagazinPageContent searchParams={searchParams} />
}
