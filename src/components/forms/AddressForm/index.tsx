'use client'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { defaultCountries as supportedCountries } from '@payloadcms/plugin-ecommerce/client/react'
import { Address, Config } from '@/payload-types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { titles } from './constants'
import { Button } from '@/components/ui/button'
import { deepMergeSimple } from 'payload/shared'
import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'

type AddressFormValues = {
  title?: string | null
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
}

type Props = {
  addressID?: Config['db']['defaultIDType']
  initialData?: Omit<Address, 'country' | 'id' | 'updatedAt' | 'createdAt'> & { country?: string }
  callback?: (data: Partial<Address>) => void
  /**
   * If true, the form will not submit to the API.
   */
  skipSubmission?: boolean
}

const countryDisplayNames =
  typeof Intl !== 'undefined'
    ? new Intl.DisplayNames(['bg'], {
        type: 'region',
      })
    : null

const getCountryLabel = (country: (typeof supportedCountries)[number]) => {
  const value = typeof country === 'string' ? country : country.value

  return countryDisplayNames?.of(value) || (typeof country === 'string' ? country : country.label) || value
}

export const AddressForm: React.FC<Props> = ({
  addressID,
  initialData,
  callback,
  skipSubmission,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<AddressFormValues>({
    defaultValues: initialData,
  })

  const { createAddress, updateAddress } = useAddresses()

  const onSubmit = useCallback(
    async (data: AddressFormValues) => {
      const newData = deepMergeSimple(initialData || {}, data)

      if (!skipSubmission) {
        if (addressID) {
          await updateAddress(addressID, newData)
        } else {
          await createAddress(newData)
        }
      }

      if (callback) {
        callback(newData)
      }
    },
    [initialData, skipSubmission, callback, addressID, updateAddress, createAddress],
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-8 flex flex-col gap-5">
        <div className="flex flex-col gap-5 md:flex-row">
          <FormItem className="shrink">
            <Label htmlFor="title">Обръщение</Label>

            <Select
              {...register('title')}
              onValueChange={(value) => {
                setValue('title', value, { shouldValidate: true })
              }}
              defaultValue={initialData?.title || ''}
            >
              <SelectTrigger id="title">
                <SelectValue placeholder="Обръщение" />
              </SelectTrigger>
              <SelectContent>
                {titles.map((title) => (
                  <SelectItem key={title.value} value={title.value}>
                    {title.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.title && <FormError message={errors.title.message} />}
          </FormItem>

          <FormItem>
            <Label htmlFor="firstName">Име*</Label>
            <Input
              id="firstName"
              autoComplete="given-name"
              {...register('firstName', { required: 'Името е задължително.' })}
            />
            {errors.firstName && <FormError message={errors.firstName.message} />}
          </FormItem>

          <FormItem>
            <Label htmlFor="lastName">Фамилия*</Label>
            <Input
              autoComplete="family-name"
              id="lastName"
              {...register('lastName', { required: 'Фамилията е задължителна.' })}
            />
            {errors.lastName && <FormError message={errors.lastName.message} />}
          </FormItem>
        </div>

        <FormItem>
          <Label htmlFor="phone">Телефон</Label>
          <Input type="tel" id="phone" autoComplete="mobile tel" {...register('phone')} />
          {errors.phone && <FormError message={errors.phone.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="company">Фирма</Label>
          <Input id="company" autoComplete="organization" {...register('company')} />
          {errors.company && <FormError message={errors.company.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="addressLine1">Адрес, ред 1*</Label>
          <Input
            id="addressLine1"
            autoComplete="address-line1"
            {...register('addressLine1', { required: 'Адресът е задължителен.' })}
          />
          {errors.addressLine1 && <FormError message={errors.addressLine1.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="addressLine2">Адрес, ред 2</Label>
          <Input id="addressLine2" autoComplete="address-line2" {...register('addressLine2')} />
          {errors.addressLine2 && <FormError message={errors.addressLine2.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="city">Град*</Label>
          <Input
            id="city"
            autoComplete="address-level2"
            {...register('city', { required: 'Градът е задължителен.' })}
          />
          {errors.city && <FormError message={errors.city.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="state">Област</Label>
          <Input id="state" autoComplete="address-level1" {...register('state')} />
          {errors.state && <FormError message={errors.state.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="postalCode">Пощенски код*</Label>
          <Input
            id="postalCode"
            {...register('postalCode', { required: 'Пощенският код е задължителен.' })}
          />
          {errors.postalCode && <FormError message={errors.postalCode.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="country">Държава*</Label>

          <Select
            {...register('country', {
              required: 'Държавата е задължителна.',
            })}
            onValueChange={(value) => {
              setValue('country', value, { shouldValidate: true })
            }}
            required
            defaultValue={initialData?.country || ''}
          >
            <SelectTrigger id="country" className="w-full">
              <SelectValue placeholder="Държава" />
            </SelectTrigger>
            <SelectContent>
              {supportedCountries.map((country) => {
                const value = typeof country === 'string' ? country : country.value
                const label = getCountryLabel(country)

                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {errors.country && <FormError message={errors.country.message} />}
        </FormItem>
      </div>

      <Button
        className="rounded-md bg-[rgb(1,55,186)] px-6 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
        type="submit"
      >
        Запази
      </Button>
    </form>
  )
}
