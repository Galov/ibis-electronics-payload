import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import { AddressListing } from '@/components/addresses/AddressListing'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'

export default async function AddressesPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Моля, влезте в профила си, за да достъпите адресите си.')}`,
    )
  }

  return (
    <div className="bg-muted/20 px-5 py-6 md:px-7 md:py-8">
      <h1 className="mb-8 text-3xl font-normal text-primary/85">Адреси</h1>

      <div className="mb-8">
        <AddressListing />
      </div>

      <CreateAddressModal />
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Управление на адресите.',
  path: '/account/addresses',
  title: 'Адреси',
})
