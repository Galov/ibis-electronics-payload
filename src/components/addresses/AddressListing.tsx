'use client'

import React from 'react'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { AddressItem } from '@/components/addresses/AddressItem'

export const AddressListing: React.FC = () => {
  const { addresses } = useAddresses()

  if (!addresses || addresses.length === 0) {
    return <p className="text-primary/65">Няма намерени адреси.</p>
  }

  return (
    <div>
      <ul className="flex flex-col gap-4">
        {addresses.map((address) => (
          <li key={address.id}>
            <AddressItem address={address} />
          </li>
        ))}
      </ul>
    </div>
  )
}
