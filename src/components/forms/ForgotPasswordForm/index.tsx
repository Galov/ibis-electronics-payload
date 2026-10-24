'use client'
import { useLocale } from '@/i18n/provider'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from '@/i18n/Link'
import React, { Fragment, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
}

export const ForgotPasswordForm: React.FC = () => {
  const locale = useLocale()
  const ui = useCommerceTranslation()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>()

  const onSubmit = useCallback(
    async (data: FormData) => {
      const response = await fetch(`/api/users/forgot-password?lang=${locale}`, {
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (response.ok) {
        setSuccess(true)
        setError('')
      } else {
        setError(
          ui(
            'Възникна проблем при изпращането на имейл за смяна на паролата. Моля, опитайте отново.',
          ),
        )
      }
    },
    [ui, locale],
  )

  return (
    <Fragment>
      {!success && (
        <React.Fragment>
          <form className="max-w-xl" onSubmit={handleSubmit(onSubmit)}>
            <Message className="mb-6" error={error} />

            <FormItem className="mb-6">
              <Label htmlFor="email" className="mb-2">
                <CommerceText source={'Имейл адрес'} />{' '}
              </Label>
              <Input
                id="email"
                {...register('email', { required: ui('Моля, въведете имейла си.') })}
                type="email"
              />
              {errors.email && <FormError message={errors.email.message} />}
            </FormItem>

            <div className="flex items-center justify-between gap-4">
              <Button
                asChild
                className="h-12 rounded-md border-black/10 px-5 text-sm font-normal text-primary/70 hover:border-black/15 hover:bg-black/[0.02] hover:text-primary"
                variant="outline"
              >
                <Link href="/login">
                  <CommerceText source={'Обратно към вход'} />
                </Link>
              </Button>
              <Button
                className="h-12 rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
                type="submit"
                variant="default"
              >
                <CommerceText source={'Изпрати линк'} />{' '}
              </Button>
            </div>
          </form>
        </React.Fragment>
      )}
      {success && (
        <React.Fragment>
          <div className="space-y-4">
            <h2 className="type-section-title text-primary">
              <CommerceText source={'Заявката е изпратена'} />{' '}
            </h2>
            <p className="type-body max-w-xl text-primary/68">
              <CommerceText
                source={'Провери имейла си за линк, чрез който сигурно да смениш паролата си.'}
              />{' '}
            </p>
            <Button
              asChild
              className="h-12 rounded-md border-black/10 px-5 text-sm font-normal text-primary/70 hover:border-black/15 hover:bg-black/[0.02] hover:text-primary"
              variant="outline"
            >
              <Link href="/login">
                <CommerceText source={'Обратно към вход'} />
              </Link>
            </Button>
          </div>
        </React.Fragment>
      )}
    </Fragment>
  )
}
