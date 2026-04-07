'use client'

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

  const onSubmit = useCallback(async (data: FormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const result = await sendOrderAccessEmail({
        email: data.email,
        orderID: data.orderID,
      })

      if (result.success) {
        setSuccess(true)
      } else {
        setSubmitError(result.error || 'Възникна проблем. Моля, опитайте отново.')
      }
    } catch {
      setSubmitError('Възникна проблем. Моля, опитайте отново.')
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  if (success) {
    return (
      <Fragment>
        <h1 className="text-xl mb-4">Провери имейла си</h1>
        <div className="prose dark:prose-invert">
          <p>
            {`Ако съществува поръчка с този имейл и номер, изпратихме ви имейл с линк към детайлите й.`}
          </p>
        </div>
      </Fragment>
    )
  }

  return (
    <Fragment>
      <h1 className="text-xl mb-4">Намери поръчката си</h1>
      <div className="prose dark:prose-invert mb-8">
        <p>{`Въведете имейла и номера на поръчката. Ще ви изпратим линк за преглед.`}</p>
      </div>
      <form className="max-w-lg flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)}>
        <FormItem>
          <Label htmlFor="email" className="mb-2">
            Имейл адрес
          </Label>
          <Input
            id="email"
            {...register('email', { required: 'Имейлът е задължителен.' })}
            type="email"
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>
        <FormItem>
          <Label htmlFor="orderID" className="mb-2">
            Номер на поръчка
          </Label>
          <Input
            id="orderID"
            {...register('orderID', {
              required: 'Номерът на поръчката е задължителен.',
            })}
            type="text"
          />
          {errors.orderID && <FormError message={errors.orderID.message} />}
        </FormItem>
        {submitError && <FormError message={submitError} />}
        <Button type="submit" className="self-start" variant="default" disabled={isSubmitting}>
          {isSubmitting ? 'Изпраща се...' : 'Намери поръчка'}
        </Button>
      </form>
    </Fragment>
  )
}
