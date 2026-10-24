import { getPageLocale, type PageLocaleParams } from '@/i18n/pageLocale'
import { localizeHref } from '@/i18n/config'
import { CommerceText } from '@/i18n/CommerceText'
import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import { AddressListing } from '@/components/addresses/AddressListing'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'

export default async function AddressesPage({ params }: { params?: PageLocaleParams }) {
  const locale = await getPageLocale(params)
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(
      localizeHref(
        `/login?warning=${encodeURIComponent('Моля, влезте в профила си, за да достъпите адресите си.')}&redirect=${encodeURIComponent(localizeHref('/account/addresses', locale))}`,
        locale,
      ),
    )
  }

  return (
    <div className="bg-muted/20 px-5 py-6 md:px-7 md:py-8">
      <h1 className="type-page-title mb-8 text-primary">
        <CommerceText source={'Адреси'} />
      </h1>

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
