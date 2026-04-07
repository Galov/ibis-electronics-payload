'use client'

import { AddressItem } from '@/components/addresses/AddressItem'
import { AddressForm } from '@/components/forms/AddressForm'
import { Button } from '@/components/ui/button'
import { Address } from '@/payload-types'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { useState } from 'react'

type Props = {
  initialAddressData?: Partial<Omit<Address, 'country' | 'id' | 'updatedAt' | 'createdAt'>> & {
    country?: string
  }
  selectedAddress?: Address
  setAddress: React.Dispatch<React.SetStateAction<Partial<Address> | undefined>>
  heading?: string
  description?: string
  setSubmit?: React.Dispatch<React.SetStateAction<() => void | Promise<void>>>
}

export const CheckoutAddresses: React.FC<Props> = ({
  initialAddressData,
  setAddress,
  heading,
  description = 'Моля, изберете или добавете адрес за доставка и фактуриране.',
}) => {
  const { addresses } = useAddresses()
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)

  if (!addresses || addresses.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-[10px] bg-muted/20 px-5 py-5">
        <div>
          {heading ? <h3 className="mb-2 text-lg font-normal text-primary/80">{heading}</h3> : null}
          <p className="text-sm text-primary/60">Няма намерени запазени адреси. Добавете нов адрес.</p>
        </div>

        <div className="rounded-[10px] bg-muted/20 px-5 py-5">
          <AddressForm
            callback={(address) => {
              setAddress(address)
              setShowNewAddressForm(false)
            }}
            initialData={initialAddressData}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        {heading ? <h3 className="mb-2 text-lg font-normal text-primary/80">{heading}</h3> : null}
        <p className="text-sm text-primary/60">{description}</p>
      </div>
      <ul className="flex flex-col gap-4">
        {addresses.map((address) => (
          <li key={address.id}>
            <AddressItem
              actions={
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    setAddress(address)
                  }}
                >
                  Избери
                </Button>
              }
              address={address}
            />
          </li>
        ))}
      </ul>

      {showNewAddressForm ? (
        <div className="rounded-[10px] bg-muted/20 px-5 py-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary/85">Нов адрес</p>
              <p className="mt-1 text-sm text-primary/60">
                Добавете нов адрес и той ще бъде запазен към профила ви.
              </p>
            </div>
            <Button
              onClick={(e) => {
                e.preventDefault()
                setShowNewAddressForm(false)
              }}
              variant="ghost"
            >
              Отказ
            </Button>
          </div>

          <AddressForm
            callback={(address) => {
              setAddress(address)
              setShowNewAddressForm(false)
            }}
            initialData={initialAddressData}
          />
        </div>
      ) : (
        <div>
          <Button
            onClick={(e) => {
              e.preventDefault()
              setShowNewAddressForm(true)
            }}
            variant="outline"
          >
            Добави нов адрес
          </Button>
        </div>
      )}
    </div>
  )
}
