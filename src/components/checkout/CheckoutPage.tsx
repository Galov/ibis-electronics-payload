'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Price } from '@/components/Price'
import { EditItemQuantityButton } from '@/components/Cart/EditItemQuantityButton'
import { AddressItem } from '@/components/addresses/AddressItem'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { CheckoutAddresses } from '@/components/checkout/CheckoutAddresses'
import { SpeedyOfficeSelector } from '@/components/checkout/SpeedyOfficeSelector'
import { CheckoutForm } from '@/components/forms/CheckoutForm'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { getProductPrimaryImage } from '@/utilities/product'
import { useAddresses, useCart } from '@payloadcms/plugin-ecommerce/client/react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import type { Address } from '@/payload-types'

export const CheckoutPage: React.FC = () => {
  const ADDRESS_SHIPPING_FEE = 6
  const SPEEDY_OFFICE_SHIPPING_FEE = 5
  const { user } = useAuth()
  const { cart } = useCart()
  const { addresses } = useAddresses()
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)
  const [shippingAddress, setShippingAddress] = useState<Partial<Address>>()
  const [deliveryMethod, setDeliveryMethod] = useState<'address' | 'speedy-office'>('address')
  const activeShippingFee =
    deliveryMethod === 'speedy-office' ? SPEEDY_OFFICE_SHIPPING_FEE : ADDRESS_SHIPPING_FEE
  const orderTotal = (cart?.subtotal || 0) + activeShippingFee
  const [speedyOffice, setSpeedyOffice] = useState<{
    address: string
    id: string
    name: string
    siteId: string
    siteName: string
    stateId: string
    stateName: string
  } | null>(null)
  const [speedySite, setSpeedySite] = useState<{
    id: string
    name: string
    region: string
  } | null>(null)
  const [speedyState, setSpeedyState] = useState<{
    id: string
    name: string
  } | null>(null)
  const [billingAddress, setBillingAddress] = useState<Partial<Address>>()
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true)
  const [isProcessingPayment, setProcessingPayment] = useState(false)

  const cartIsEmpty = !cart || !cart.items || !cart.items.length

  useEffect(() => {
    if (!shippingAddress && addresses && addresses.length > 0) {
      const defaultAddress = addresses[0]

      if (defaultAddress) {
        setBillingAddress(defaultAddress)
      }
    }
  }, [addresses, shippingAddress])

  useEffect(() => {
    return () => {
      setShippingAddress(undefined)
      setDeliveryMethod('address')
      setSpeedyOffice(null)
      setSpeedySite(null)
      setSpeedyState(null)
      setBillingAddress(undefined)
      setBillingAddressSameAsShipping(true)
      setEmail('')
      setEmailEditable(true)
    }
  }, [])

  if (cartIsEmpty && isProcessingPayment) {
    return (
      <div className="w-full items-center justify-center py-12">
        <div className="prose mb-8 max-w-none self-center text-center dark:prose-invert">
          <p>Поръчката се изпраща...</p>
        </div>
        <LoadingSpinner />
      </div>
    )
  }

  if (cartIsEmpty) {
    return (
      <div className="w-full py-12 text-primary/70">
        <p className="mb-3 text-lg">Количката е празна.</p>
        <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/shop">
          Продължи с пазаруването
        </Link>
      </div>
    )
  }

  const canSubmitOrder = Boolean(
    (email || user) &&
      billingAddress &&
      (deliveryMethod === 'speedy-office' || billingAddressSameAsShipping || shippingAddress) &&
      (deliveryMethod === 'address' || speedyOffice),
  )

  return (
    <div className="my-8 flex grow flex-col items-stretch justify-stretch gap-10 md:flex-row md:gap-6 lg:gap-8">
      <div className="flex basis-full flex-col justify-stretch gap-8 lg:basis-2/3">
        <h2 className="text-2xl font-normal text-primary/85">Контакт</h2>

        {!user && (
          <div className="flex w-full items-center bg-muted/20 px-5 py-4">
            <div className="text-sm leading-7 text-primary/65">
              <Button asChild className="text-inherit no-underline" variant="outline">
                <Link href="/login?redirect=/checkout">Вход</Link>
              </Button>
              <p className="mt-0">
                <span className="mx-2">или</span>
                <Link href="/create-account?redirect=/checkout">създай профил</Link>
              </p>
            </div>
          </div>
        )}

        {user ? (
          <div className="bg-muted/20 px-5 py-4">
            <p className="text-sm text-primary/75">{user.email}</p>
            <p className="text-sm text-primary/65">
              Не сте вие?{' '}
              <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/logout">
                Изход
              </Link>
            </p>
          </div>
        ) : (
          <div className="bg-muted/20 px-5 py-4">
            <p className="mb-4 text-primary/65">Въведи имейл, за да продължиш като гост.</p>

            <FormItem className="mb-6">
              <Label htmlFor="email">Имейл адрес</Label>
              <Input
                disabled={!emailEditable}
                id="email"
                name="email"
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
              />
            </FormItem>

            <Button
              className="rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
              disabled={!email || !emailEditable}
              onClick={(e) => {
                e.preventDefault()
                setEmailEditable(false)
              }}
              variant="default"
            >
              Продължи като гост
            </Button>
          </div>
        )}

        <h2 className="text-2xl font-normal text-primary/85">Адрес</h2>

        {billingAddress ? (
          <AddressItem
            actions={
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  setBillingAddress(undefined)
                }}
                variant="outline"
              >
                Премахни
              </Button>
            }
            address={billingAddress}
          />
        ) : user ? (
          <CheckoutAddresses heading="Адрес за фактуриране" setAddress={setBillingAddress} />
        ) : (
          <CreateAddressModal
            callback={(address) => {
              setBillingAddress(address)
            }}
            disabled={!email || emailEditable}
            skipSubmission={true}
          />
        )}

        <div className="flex items-center gap-4">
          <div className="w-full rounded-[10px] bg-muted/20 px-5 py-5">
            <p className="mb-4 text-sm text-primary/65">Избери начин на доставка.</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className={`rounded-[10px] border px-4 py-3 text-left transition ${
                  deliveryMethod === 'address'
                    ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                    : 'border-black/8 bg-white hover:border-black/15'
                }`}
                onClick={(event) => {
                  event.preventDefault()
                  setDeliveryMethod('address')
                }}
                type="button"
              >
                <p className="text-sm font-medium text-primary/85">Доставка до адрес</p>
                <p className="mt-1 text-sm text-primary/60">
                  Използвай въведения адрес за доставка. +6 EUR
                </p>
              </button>

              <button
                className={`rounded-[10px] border px-4 py-3 text-left transition ${
                  deliveryMethod === 'speedy-office'
                    ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                    : 'border-black/8 bg-white hover:border-black/15'
                }`}
                onClick={(event) => {
                  event.preventDefault()
                  setDeliveryMethod('speedy-office')
                }}
                type="button"
              >
                <p className="text-sm font-medium text-primary/85">Доставка до офис на Speedy</p>
                <p className="mt-1 text-sm text-primary/60">Избери удобен офис на Speedy. +5 EUR</p>
              </button>
            </div>
          </div>
        </div>

        {deliveryMethod === 'address' ? (
          <div className="flex items-center gap-4">
            <Checkbox
              checked={billingAddressSameAsShipping}
              disabled={Boolean(!user && (!email || emailEditable))}
              id="shippingTheSameAsBilling"
              onCheckedChange={(state) => {
                setBillingAddressSameAsShipping(state as boolean)
              }}
            />
            <Label
              className="font-sans font-normal tracking-normal text-primary/65"
              htmlFor="shippingTheSameAsBilling"
            >
              Адресът за доставка е същият
            </Label>
          </div>
        ) : null}

        {deliveryMethod === 'address' &&
          !billingAddressSameAsShipping &&
          (shippingAddress ? (
            <AddressItem
              actions={
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    setShippingAddress(undefined)
                  }}
                  variant="outline"
                >
                  Премахни
                </Button>
              }
              address={shippingAddress}
            />
          ) : user ? (
            <CheckoutAddresses
              description="Моля, изберете адрес за доставка."
              heading="Адрес за доставка"
              setAddress={setShippingAddress}
            />
          ) : (
            <CreateAddressModal
              callback={(address) => {
                setShippingAddress(address)
              }}
              disabled={!email || emailEditable}
              skipSubmission={true}
            />
          ))}

        {deliveryMethod === 'speedy-office' ? (
          <SpeedyOfficeSelector
            disabled={Boolean(!user && (!email || emailEditable))}
            onSelect={({ office, site, state }) => {
              setSpeedyOffice({
                ...office,
                siteName: site.name,
                stateId: state.id,
                stateName: state.name,
              })
              setSpeedySite(site)
              setSpeedyState(state)
            }}
            selectedOffice={speedyOffice}
            selectedSite={speedySite}
            selectedState={speedyState}
          />
        ) : null}

        <div className="bg-muted/20 px-5 py-4 text-sm text-primary/60">
          Не се събира онлайн плащане. Изпращането на формата създава заявка за поръчка за
          ръчна обработка.
        </div>

        {canSubmitOrder && (
          <CheckoutForm
            billingAddress={billingAddress}
            customerEmail={email}
            deliveryMethod={deliveryMethod}
            setProcessingPayment={setProcessingPayment}
            shippingFee={activeShippingFee}
            shippingAddress={
              deliveryMethod === 'address'
                ? billingAddressSameAsShipping
                  ? billingAddress
                  : shippingAddress
                : undefined
            }
            speedyOffice={speedyOffice}
          />
        )}
      </div>

      <div className="flex basis-full flex-col gap-6 bg-muted/20 px-5 pb-6 pt-1 md:px-7 md:pb-8 md:pt-1 lg:basis-1/3">
        <h2 className="text-2xl font-normal text-primary/85">Твоята количка</h2>

        {cart?.items?.map((item, index) => {
          if (typeof item.product !== 'object' || !item.quantity) {
            return null
          }

          const image = getProductPrimaryImage(item.product)

          return (
            <div className="flex items-start gap-3 border-b border-black/5 pb-4 last:border-b-0 last:pb-0" key={index}>
              <div className="flex h-16 w-16 items-stretch justify-stretch rounded-md border border-black/8 bg-white p-2">
                <div className="relative h-full w-full">
                  {image?.url ? (
                    <Image
                      alt={image.alt}
                      className="rounded-md object-contain"
                      fill
                      sizes="64px"
                      src={image.url}
                    />
                  ) : null}
                </div>
              </div>
              <div className="flex grow items-center justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-5 text-primary/85">{item.product.title}</p>
                  <div className="flex h-8 w-fit flex-row items-center rounded-md border border-black/10 bg-white">
                    <EditItemQuantityButton item={item} type="minus" />
                    <p className="w-8 text-center text-sm text-primary/70">{item.quantity}</p>
                    <EditItemQuantityButton item={item} type="plus" />
                  </div>
                </div>

                {typeof item.product.price === 'number' && (
                  <Price amount={item.product.price} className="text-sm text-primary/75" currencyCode="EUR" />
                )}
              </div>
            </div>
          )
        })}

        <div className="border-t border-black/5 pt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary/45">
              Доставка
            </span>
            <Price amount={activeShippingFee} className="text-base font-medium text-primary/70" currencyCode="EUR" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary/45">Общо</span>
            <Price amount={orderTotal} className="text-2xl font-medium text-primary/80" currencyCode="EUR" />
          </div>
        </div>
      </div>
    </div>
  )
}
