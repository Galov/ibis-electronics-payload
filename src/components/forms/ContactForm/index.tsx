'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { submitContactInquiry } from './submitContactInquiry'

type FormData = {
  email: string
  message: string
  name: string
  phone: string
  privacyAccepted: boolean
}

export const ContactForm: React.FC = () => {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      message: '',
      name: '',
      phone: '',
      privacyAccepted: false,
    },
  })

  const onSubmit = useCallback(async (data: FormData) => {
    const result = await submitContactInquiry(data)

    if (result.success) {
      setError('')
      setSuccess('Запитването е изпратено успешно. Ще се свържем с вас възможно най-скоро.')
      reset()
      return
    }

    setSuccess('')
    setError(result.error || 'Възникна проблем при изпращането на запитването.')
  }, [reset])

  return (
    <form className="max-w-2xl" onSubmit={handleSubmit(onSubmit)}>
      <Message className="mb-6" error={error} success={success} />

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <FormItem>
          <Label htmlFor="name" className="mb-2">
            Име
          </Label>
          <Input
            id="name"
            {...register('name', { required: 'Моля, въведете име.' })}
            type="text"
          />
          {errors.name && <FormError message={errors.name.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="email" className="mb-2">
            Имейл
          </Label>
          <Input
            id="email"
            {...register('email', { required: 'Моля, въведете имейл.' })}
            type="email"
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>
      </div>

      <div className="mb-6 grid gap-6">
        <FormItem>
          <Label htmlFor="phone" className="mb-2">
            Телефон
          </Label>
          <Input id="phone" {...register('phone')} type="text" />
        </FormItem>

        <FormItem>
          <Label htmlFor="message" className="mb-2">
            Съобщение
          </Label>
          <textarea
            id="message"
            className="min-h-40 w-full rounded-md border border-black/10 bg-white px-4 py-3 text-sm text-primary outline-none transition focus:border-[rgb(1,55,186)]/40"
            {...register('message', { required: 'Моля, въведете съобщение.' })}
          />
          {errors.message && <FormError message={errors.message.message} />}
        </FormItem>

        <FormItem>
          <label className="flex items-start gap-3 text-sm leading-6 text-primary/70">
            <input
              className="mt-1 h-4 w-4 shrink-0 accent-[rgb(1,55,186)]"
              type="checkbox"
              {...register('privacyAccepted', {
                required: 'Трябва да потвърдите, че сте съгласни с политиката за поверителност.',
              })}
            />
            <span>
              Съгласен съм с{' '}
              <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/privacy">
                политиката за поверителност
              </Link>
              .
            </span>
          </label>
          {errors.privacyAccepted && <FormError message={errors.privacyAccepted.message} />}
        </FormItem>
      </div>

      <Button
        className="h-12 rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
        disabled={isSubmitting}
        type="submit"
        variant="default"
      >
        {isSubmitting ? 'Обработва се' : 'Изпрати'}
      </Button>
    </form>
  )
}
