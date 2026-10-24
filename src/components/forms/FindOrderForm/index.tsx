'use client'
import { useLocale } from '@/i18n/provider'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import React, { Fragment, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { sendOrderAccessEmail } from './sendOrderAccessEmail'

type FormData = {
  email: string
  orderID: string
}

type Props = {
  initialEmail?: string
}

export const FindOrderForm: React.FC<Props> = ({ initialEmail }) => {
  const locale = useLocale()
  const ui = useCommerceTranslation()

  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>({
    defaultValues: {
      email: initialEmail || user?.email,
    },
  })

  const onSubmit = useCallback(
    async (data: FormData) => {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const result = await sendOrderAccessEmail({
          locale,
          email: data.email,
          orderID: data.orderID,
        })

        if (result.success) {
          setSuccess(true)
        } else {
          setSubmitError(result.error || ui('Възникна проблем. Моля, опитайте отново.'))
        }
      } catch {
        setSubmitError(ui('Възникна проблем. Моля, опитайте отново.'))
      } finally {
        setIsSubmitting(false)
      }
    },
    [ui, locale],
  )

  if (success) {
    return (
      <Fragment>
        <h1 className="text-xl mb-4">
          <CommerceText source={'Провери имейла си'} />
        </h1>
        <div className="prose dark:prose-invert">
          <p>
            {ui(
              'Ако съществува поръчка с този имейл и номер, изпратихме ви имейл с линк към детайлите й.',
            )}
          </p>
        </div>
      </Fragment>
    )
  }

  return (
    <Fragment>
      <h1 className="text-xl mb-4">
        <CommerceText source={'Намери поръчката си'} />
      </h1>
      <div className="prose dark:prose-invert mb-8">
        <p>{ui('Въведете имейла и номера на поръчката. Ще ви изпратим линк за преглед.')}</p>
      </div>
      <form className="max-w-lg flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)}>
        <FormItem>
          <Label htmlFor="email" className="mb-2">
            <CommerceText source={'Имейл адрес'} />{' '}
          </Label>
          <Input
            id="email"
            {...register('email', { required: ui('Имейлът е задължителен.') })}
            type="email"
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>
        <FormItem>
          <Label htmlFor="orderID" className="mb-2">
            <CommerceText source={'Номер на поръчка'} />{' '}
          </Label>
          <Input
            id="orderID"
            {...register('orderID', {
              required: ui('Номерът на поръчката е задължителен.'),
            })}
            type="text"
          />
          {errors.orderID && <FormError message={errors.orderID.message} />}
        </FormItem>
        {submitError && <FormError message={submitError} />}
        <Button type="submit" className="self-start" variant="default" disabled={isSubmitting}>
          {isSubmitting ? ui('Изпраща се...') : ui('Намери поръчка')}
        </Button>
      </form>
    </Fragment>
  )
}
