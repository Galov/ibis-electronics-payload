'use client'
import React, { useCallback, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddresses } from '@payloadcms/plugin-ecommerce/client/react'
import { Address, Config } from '@/payload-types'
import { Button } from '@/components/ui/button'
import { deepMergeSimple } from 'payload/shared'
import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'

type AddressFormValues = {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

type Props = {
  addressID?: Config['db']['defaultIDType']
  initialData?: Omit<Address, 'country' | 'id' | 'updatedAt' | 'createdAt'> & { country?: string }
  callback?: (data: Partial<Address> | undefined) => void
  submitLabel?: string
  /**
   * If true, the form will not submit to the API.
   */
  skipSubmission?: boolean
}

export const AddressForm: React.FC<Props> = ({
  addressID,
  initialData,
  callback,
  submitLabel,
  skipSubmission,
}) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormValues>({
    defaultValues: {
      ...initialData,
      country: 'BG',
    },
  })

  const { createAddress, updateAddress } = useAddresses()
  const watchedValues = useWatch({ control })

  useEffect(() => {
    if (!skipSubmission || !callback) {
      return
    }

    const hasAddressInput = Boolean(
      watchedValues?.state?.trim() ||
        watchedValues?.city?.trim() ||
        watchedValues?.postalCode?.trim() ||
        watchedValues?.addressLine1?.trim() ||
        watchedValues?.addressLine2?.trim(),
    )

    if (!hasAddressInput) {
      callback(undefined)
      return
    }

    callback(deepMergeSimple(initialData || {}, watchedValues))
  }, [callback, initialData, skipSubmission, watchedValues])

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
        <FormItem>
          <Label htmlFor="state">Област*</Label>
          <Input
            id="state"
            autoComplete="address-level1"
            {...register('state', { required: 'Областта е задължителна.' })}
          />
          {errors.state && <FormError message={errors.state.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="city">Населено място*</Label>
          <Input
            id="city"
            autoComplete="address-level2"
            {...register('city', { required: 'Населеното място е задължително.' })}
          />
          {errors.city && <FormError message={errors.city.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="postalCode">Пощенски код</Label>
          <Input id="postalCode" autoComplete="postal-code" {...register('postalCode')} />
          {errors.postalCode && <FormError message={errors.postalCode.message} />}
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

        <input type="hidden" value="BG" {...register('country', {
          required: 'Държавата е задължителна.',
        })} />
      </div>

      {!skipSubmission ? (
        <Button
          className="rounded-md bg-[rgb(1,55,186)] px-6 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
          type="submit"
        >
          {submitLabel || 'Запази адреса'}
        </Button>
      ) : null}
    </form>
  )
}
