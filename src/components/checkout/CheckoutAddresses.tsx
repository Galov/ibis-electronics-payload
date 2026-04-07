'use client'

import { AddressItem } from '@/components/addresses/AddressItem'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Address } from '@/payload-types'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { useState } from 'react'

type Props = {
  selectedAddress?: Address
  setAddress: React.Dispatch<React.SetStateAction<Partial<Address> | undefined>>
  heading?: string
  description?: string
  setSubmit?: React.Dispatch<React.SetStateAction<() => void | Promise<void>>>
}

export const CheckoutAddresses: React.FC<Props> = ({
  setAddress,
  heading = 'Адреси',
  description = 'Моля, изберете или добавете адрес за доставка и фактуриране.',
}) => {
  const { addresses } = useAddresses()

  if (!addresses || addresses.length === 0) {
    return (
      <div>
        <p>Няма намерени адреси. Моля, добавете адрес.</p>

        <CreateAddressModal />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-2 text-lg font-normal text-primary/80">{heading}</h3>
        <p className="text-sm text-primary/60">{description}</p>
      </div>
      <AddressesModal setAddress={setAddress} />
    </div>
  )
}

const AddressesModal: React.FC<Props> = ({ setAddress }) => {
  const [open, setOpen] = useState(false)
  const handleOpenChange = (state: boolean) => {
    setOpen(state)
  }

  const closeModal = () => {
    setOpen(false)
  }
  const { addresses } = useAddresses()

  if (!addresses || addresses.length === 0) {
    return <p>Няма намерени адреси. Моля, добавете адрес.</p>
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={'outline'}>{'Избери адрес'}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{'Избери адрес'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-12">
          <ul className="flex flex-col gap-8">
            {addresses.map((address) => (
              <li key={address.id} className="border-b pb-8 last:border-none">
                <AddressItem
                  address={address}
                  beforeActions={
                    <Button
                    onClick={(e) => {
                      e.preventDefault()
                      setAddress(address)
                      closeModal()
                    }}
                  >
                      Избери
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>

          <CreateAddressModal />
        </div>
      </DialogContent>
    </Dialog>
  )
}
