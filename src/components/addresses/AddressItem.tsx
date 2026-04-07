'use client'

import React from 'react'
import type { Address } from '@/payload-types'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'

type Props = {
  address: Partial<Omit<Address, 'country'>> & { country?: string } // Allow address to be partial and entirely optional as this is entirely for display purposes
  /**
   * Completely override the default actions
   */
  actions?: React.ReactNode
  /**
   * Insert elements before the actions
   */
  beforeActions?: React.ReactNode
  /**
   * Insert elements after the actions
   */
  afterActions?: React.ReactNode
  /**
   * Hide all actions
   */
  hideActions?: boolean
}

export const AddressItem: React.FC<Props> = ({
  address,
  actions,
  hideActions = false,
  beforeActions,
  afterActions,
}) => {
  if (!address) {
    return null
  }

  return (
    <div className="flex items-start justify-between gap-6 rounded-[10px] border border-transparent bg-white px-5 py-5 transition duration-300 ease-out hover:border-black/5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
      <div className="grow">
        <p className="font-medium text-primary/85">
          {address.title && <span>{address.title} </span>}
          {address.firstName} {address.lastName}
        </p>
        <div className="mt-2 space-y-1 text-sm text-primary/60">
          <p>{address.company && <span>{address.company} </span>}</p>
          <p>{address.phone && <span>{address.phone}</span>}</p>
          <p>
          {address.addressLine1}
          {address.addressLine2 && <>, {address.addressLine2}</>}
          </p>
          <p>
            {address.city}, {address.state} {address.postalCode}
          </p>
          <p>{address.country}</p>
        </div>
      </div>

      {!hideActions && address.id && (
        <div className="shrink flex flex-col gap-2">
          {actions ? (
            actions
          ) : (
            <>
              {beforeActions}
              {address.id && (
                <CreateAddressModal
                  addressID={address.id}
                  initialData={address}
                  buttonText={'Редактирай'}
                  modalTitle={'Редактиране на адрес'}
                />
              )}
              {afterActions}
            </>
          )}
        </div>
      )}
    </div>
  )
}
