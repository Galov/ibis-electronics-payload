'use client'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from '@/i18n/Link'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { submitContactInquiry } from './submitContactInquiry'

type FormData = {
  email: string
  website: string
  message: string
  name: string
  phone: string
  privacyAccepted: boolean
  submittedAt: number
}

export const ContactForm: React.FC = () => {
  const ui = useCommerceTranslation()

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
      website: '',
      message: '',
      name: '',
      phone: '',
      privacyAccepted: false,
      submittedAt: Date.now(),
    },
  })

  const onSubmit = useCallback(
    async (data: FormData) => {
      const result = await submitContactInquiry(data)

      if (result.success) {
        setError('')
        setSuccess(ui('Запитването е изпратено успешно. Ще се свържем с вас възможно най-скоро.'))
        reset({
          email: '',
          website: '',
          message: '',
          name: '',
          phone: '',
          privacyAccepted: false,
          submittedAt: Date.now(),
        })
        return
      }

      setSuccess('')
      setError(result.error || ui('Възникна проблем при изпращането на запитването.'))
    },
    [reset, ui],
  )

  return (
    <form className="max-w-2xl" onSubmit={handleSubmit(onSubmit)}>
      <Message className="mb-6" error={error} success={success} />

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <FormItem>
          <Label htmlFor="name" className="mb-2">
            <CommerceText source={'Име'} />{' '}
          </Label>
          <Input
            id="name"
            {...register('name', { required: ui('Моля, въведете име.') })}
            type="text"
          />
          {errors.name && <FormError message={errors.name.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="email" className="mb-2">
            <CommerceText source={'Имейл'} />{' '}
          </Label>
          <Input
            id="email"
            {...register('email', { required: ui('Моля, въведете имейл.') })}
            type="email"
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>
      </div>

      <div className="mb-6 grid gap-6">
        <input
          autoComplete="off"
          className="pointer-events-none absolute left-[-9999px] top-auto h-px w-px overflow-hidden opacity-0"
          tabIndex={-1}
          type="text"
          {...register('website')}
        />
        <input type="hidden" {...register('submittedAt', { valueAsNumber: true })} />

        <FormItem>
          <Label htmlFor="phone" className="mb-2">
            <CommerceText source={'Телефон'} />{' '}
          </Label>
          <Input id="phone" {...register('phone')} type="text" />
        </FormItem>

        <FormItem>
          <Label htmlFor="message" className="mb-2">
            <CommerceText source={'Съобщение'} />{' '}
          </Label>
          <textarea
            id="message"
            className="min-h-40 w-full rounded-md border border-black/10 bg-white px-4 py-3 text-sm text-primary outline-none transition focus:border-[rgb(1,55,186)]/40"
            {...register('message', { required: ui('Моля, въведете съобщение.') })}
          />
          {errors.message && <FormError message={errors.message.message} />}
        </FormItem>

        <FormItem>
          <label className="flex items-start gap-3 text-sm leading-6 text-primary/70">
            <input
              className="mt-1 h-4 w-4 shrink-0 accent-[rgb(1,55,186)]"
              type="checkbox"
              {...register('privacyAccepted', {
                required: ui(
                  'Трябва да потвърдите, че сте съгласни с политиката за поверителност.',
                ),
              })}
            />
            <span>
              <CommerceText source={'Съгласен съм с'} />{' '}
              <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/privacy">
                <CommerceText source={'политиката за поверителност'} />{' '}
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
        {isSubmitting ? ui('Обработва се') : ui('Изпрати')}
      </Button>
    </form>
  )
}
