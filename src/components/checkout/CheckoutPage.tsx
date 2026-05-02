'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Price } from '@/components/Price'
import { EditItemQuantityButton } from '@/components/Cart/EditItemQuantityButton'
import { AddressItem } from '@/components/addresses/AddressItem'
import { CheckoutAddresses } from '@/components/checkout/CheckoutAddresses'
import { EcontOfficeSelector } from '@/components/checkout/EcontOfficeSelector'
import { SpeedyOfficeSelector } from '@/components/checkout/SpeedyOfficeSelector'
import { AddressForm } from '@/components/forms/AddressForm'
import { CheckoutForm } from '@/components/forms/CheckoutForm'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/providers/Auth'
import { getProductPrimaryImage } from '@/utilities/product'
import { useAddresses, useCart } from '@payloadcms/plugin-ecommerce/client/react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import type { Address } from '@/payload-types'

export const CheckoutPage: React.FC<{
  freeShippingThreshold?: number
  revolutPayEnabled?: boolean
}> = ({
  freeShippingThreshold: _freeShippingThreshold,
  revolutPayEnabled = false,
}) => {
  const deliveryPricingNote =
    'Цената не включва доставката. Тя се определя по тарифата на избраната куриерска компания и се заплаща при получаване на пратката.'
  const { user } = useAuth()
  const { cart } = useCart()
  const { addresses } = useAddresses()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [shippingAddress, setShippingAddress] = useState<Partial<Address>>()
  const [deliveryMethod, setDeliveryMethod] = useState<'address' | 'speedy-office' | 'econt-office'>('address')
  const orderTotal = cart?.subtotal || 0
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
  const [econtCity, setEcontCity] = useState<{
    id: string
    name: string
    region: string
  } | null>(null)
  const [econtOffice, setEcontOffice] = useState<{
    address: string
    cityId: string
    cityName: string
    code: string
    id: string
    isAPS: boolean
    isMPS: boolean
    name: string
    regionId: string
    regionName: string
  } | null>(null)
  const [econtRegion, setEcontRegion] = useState<{
    id: string
    name: string
  } | null>(null)
  const [isProcessingPayment, setProcessingPayment] = useState(false)

  const cartIsEmpty = !cart || !cart.items || !cart.items.length
  const hasCompleteAddress = (address?: Partial<Address>) =>
    Boolean(address?.state?.trim() && address?.city?.trim() && address?.addressLine1?.trim())

  useEffect(() => {
    if (!billingAddress && addresses && addresses.length > 0) {
      const defaultAddress = addresses[0]

      if (defaultAddress) {
        setBillingAddress(defaultAddress)

        setFirstName((current) => current || defaultAddress.firstName || '')
        setLastName((current) => current || defaultAddress.lastName || '')
        setPhone((current) => current || defaultAddress.phone || '')
        setEmail((current) => current || user?.email || '')
      }
    }
  }, [addresses, billingAddress, user?.email])

  useEffect(() => {
    if (user?.email) {
      setEmail((current) => current || user.email)
    }
  }, [user?.email])

  useEffect(() => {
    return () => {
      setShippingAddress(undefined)
      setDeliveryMethod('address')
      setSpeedyOffice(null)
      setSpeedySite(null)
      setSpeedyState(null)
      setEcontCity(null)
      setEcontOffice(null)
      setEcontRegion(null)
      setBillingAddress(undefined)
      setBillingAddressSameAsShipping(true)
      setEmail('')
      setFirstName('')
      setLastName('')
      setPhone('')
      setCustomerNotes('')
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
    firstName.trim() &&
      lastName.trim() &&
      phone.trim() &&
      (deliveryMethod !== 'address' || hasCompleteAddress(billingAddress)) &&
      ((deliveryMethod !== 'address') ||
        billingAddressSameAsShipping ||
        hasCompleteAddress(shippingAddress)) &&
      (deliveryMethod === 'address' ||
        (deliveryMethod === 'speedy-office' && speedyOffice) ||
        (deliveryMethod === 'econt-office' && econtOffice)),
  )

  const customerContactAddress: Partial<Address> = {
    country: 'BG',
    firstName,
    lastName,
    phone,
  }

  const resolvedBillingAddress = billingAddress
    ? {
        ...billingAddress,
        firstName,
        lastName,
        phone,
      }
    : customerContactAddress

  const resolvedShippingAddress =
    deliveryMethod === 'address'
      ? billingAddressSameAsShipping
        ? resolvedBillingAddress
        : shippingAddress
          ? {
              ...shippingAddress,
              firstName,
              lastName,
              phone,
            }
          : undefined
      : customerContactAddress

  return (
    <div className="my-8 flex grow flex-col items-stretch justify-stretch gap-10 md:flex-row md:gap-6 lg:gap-8">
      <div className="flex basis-full flex-col justify-stretch gap-8 lg:basis-2/3">
        <h2 className="type-section-title text-primary/85">Контакт</h2>

        <div className="rounded-[10px] bg-muted/20 px-5 py-5 md:px-6">
          {!user && (
            <div className="mb-6 rounded-[10px] border border-black/6 bg-white px-4 py-4">
              <p className="type-subsection-title text-primary/85">Поръчваш като гост</p>
              <p className="type-body-small mt-2 text-primary/60">
                Можеш да завършиш поръчката и без профил. Ако влезеш или създадеш акаунт, ще имаш
                по-лесен достъп до адресите и историята на поръчките си.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="sm:min-w-32" variant="outline">
                  <Link href="/login?redirect=/checkout">Вход</Link>
                </Button>
                <Button asChild className="sm:min-w-40" variant="ghost">
                  <Link href="/create-account?redirect=/checkout">Създай профил</Link>
                </Button>
              </div>
            </div>
          )}

          {user ? (
            <div className="mb-6 rounded-[10px] border border-black/6 bg-white px-4 py-4">
              <p className="type-subsection-title text-primary/85">Продължаваш като {user.email}</p>
              <p className="type-body-small mt-2 text-primary/60">
                Попълни данните за контакт и избери начин на доставка, за да изпратим заявката за
                поръчка.
              </p>
              <div className="mt-4">
                <Link className="text-sm text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/logout">
                  Изход
                </Link>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <p className="type-subsection-title text-primary/85">Данни за контакт</p>
              <p className="type-body-small mt-2 text-primary/60">
                Телефонът е задължителен, за да можем да се свържем с теб при нужда. Имейлът е
                по желание.
              </p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <FormItem>
              <Label htmlFor="firstName">Име</Label>
              <Input
                autoComplete="given-name"
                id="firstName"
                onChange={(e) => setFirstName(e.target.value)}
                required
                value={firstName}
              />
            </FormItem>

            <FormItem>
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                autoComplete="family-name"
                id="lastName"
                onChange={(e) => setLastName(e.target.value)}
                required
                value={lastName}
              />
            </FormItem>

            <FormItem>
              <Label htmlFor="email">Имейл</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
            </FormItem>

            <FormItem>
              <Label htmlFor="phone">Телефон</Label>
              <Input
                autoComplete="tel"
                id="phone"
                onChange={(e) => setPhone(e.target.value)}
                required
                type="tel"
                value={phone}
              />
            </FormItem>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-full rounded-[10px] bg-muted/20 px-5 py-5">
            <p className="mb-4 text-sm text-primary/65">Избери начин на доставка.</p>

            <div className="grid gap-3 sm:grid-cols-3">
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
                <p className="type-subsection-title text-primary/85">Адрес</p>
                <p className="mt-1 text-sm text-primary/60">Използвай въведения адрес за доставка.</p>
              </button>

              <button
                className={`rounded-[10px] border px-4 py-3 text-left transition ${
                  deliveryMethod === 'econt-office'
                    ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                    : 'border-black/8 bg-white hover:border-black/15'
                }`}
                onClick={(event) => {
                  event.preventDefault()
                  setDeliveryMethod('econt-office')
                }}
                type="button"
              >
                <p className="type-subsection-title text-primary/85">Офис на Econt</p>
                <p className="mt-1 text-sm text-primary/60">Избери удобен офис.</p>
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
                <p className="type-subsection-title text-primary/85">Офис на Speedy</p>
                <p className="mt-1 text-sm text-primary/60">Избери удобен офис.</p>
              </button>
            </div>
            <p className="mt-4 text-sm text-primary/60">{deliveryPricingNote}</p>
          </div>
        </div>

        {deliveryMethod === 'address' ? (
          <>
            {!user ? (
              <div className="rounded-[10px] bg-muted/20 px-5 py-5">
                <AddressForm
                  callback={(address) => {
                    setBillingAddress(address)
                  }}
                  initialData={{
                    firstName,
                    lastName,
                    phone,
                  }}
                  skipSubmission={true}
                />
              </div>
            ) : billingAddress ? (
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
              <CheckoutAddresses
                description="Избери адреса, на който искаш да бъде доставена поръчката."
                initialAddressData={{
                  firstName,
                  lastName,
                  phone,
                }}
                setAddress={setBillingAddress}
              />
            ) : null}

            {user ? (
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={billingAddressSameAsShipping}
                  disabled={Boolean(!firstName.trim() || !lastName.trim() || !phone.trim())}
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
          </>
        ) : null}

        {deliveryMethod === 'address' &&
          user &&
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
              description="Избери адреса, на който искаш да бъде доставена поръчката."
              initialAddressData={{
                firstName,
                lastName,
                phone,
              }}
              setAddress={setShippingAddress}
            />
          ) : (
            <div className="rounded-[10px] bg-muted/20 px-5 py-5">
              <AddressForm
                callback={(address) => {
                  setShippingAddress(address)
                }}
                initialData={{
                  firstName,
                  lastName,
                  phone,
                }}
                skipSubmission={true}
              />
            </div>
          ))}

        {deliveryMethod === 'speedy-office' ? (
          <SpeedyOfficeSelector
            onSelect={({ office, site, state }) => {
              if (!office || !site || !state) {
                setSpeedyOffice(null)
                setSpeedySite(site)
                setSpeedyState(state)
                return
              }

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

        {deliveryMethod === 'econt-office' ? (
          <EcontOfficeSelector
            onSelect={({ city, office, region }) => {
              if (!office || !city || !region) {
                setEcontOffice(null)
                setEcontCity(city)
                setEcontRegion(region)
                return
              }

              setEcontOffice({
                ...office,
                cityId: city.id,
                cityName: city.name,
                regionId: region.id,
                regionName: region.name,
              })
              setEcontCity(city)
              setEcontRegion(region)
            }}
            selectedCity={econtCity}
            selectedOffice={econtOffice}
            selectedRegion={econtRegion}
          />
        ) : null}

        <div className="rounded-[10px] bg-muted/20 px-5 py-5">
          <FormItem>
            <Label htmlFor="customerNotes">Бележки към поръчката</Label>
            <Textarea
              id="customerNotes"
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Допълнителни инструкции за доставка или уточнения към поръчката."
              rows={6}
              value={customerNotes}
            />
          </FormItem>
        </div>

        <div className="bg-muted/20 px-5 py-4 text-sm text-primary/60">
          {revolutPayEnabled
            ? 'Можеш да изпратиш заявка за ръчна обработка или да платиш онлайн с карта или през Revolut Pay.'
            : 'Не се събира онлайн плащане. Изпращането на формата създава заявка за поръчка за ръчна обработка.'}
        </div>

        <CheckoutForm
          billingAddress={resolvedBillingAddress}
          customerEmail={email}
          customerNotes={customerNotes}
          deliveryMethod={deliveryMethod}
          disabled={!canSubmitOrder}
          econtOffice={econtOffice}
          revolutPayEnabled={revolutPayEnabled}
          setProcessingPayment={setProcessingPayment}
          shippingFee={0}
          shippingAddress={resolvedShippingAddress}
          speedyOffice={speedyOffice}
          totalAmount={orderTotal}
        />
      </div>

      <div className="flex basis-full flex-col gap-6 bg-muted/20 px-5 pb-6 pt-1 md:px-7 md:pb-8 md:pt-1 lg:basis-1/3">
        <h2 className="type-section-title text-primary/85">Твоята количка</h2>

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
          <div className="mb-3 flex items-start justify-between gap-4">
            <span className="type-eyebrow text-primary/45">Доставка</span>
            <p className="max-w-[16rem] text-right text-sm leading-6 text-primary/60">{deliveryPricingNote}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="type-eyebrow text-primary/45">Общо</span>
            <Price amount={orderTotal} className="text-2xl font-medium text-primary/80" currencyCode="EUR" />
          </div>
        </div>
      </div>
    </div>
  )
}
