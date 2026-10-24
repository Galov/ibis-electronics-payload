'use client'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { safeReturnHref } from '@/i18n/config'
import { useLocale } from '@/i18n/provider'
import { useLocalizedRouter } from '@/i18n/navigation'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import Link from '@/i18n/Link'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
  passwordConfirm: string
}

export const CreateAccountForm: React.FC = () => {
  const locale = useLocale()
  const ui = useCommerceTranslation()

  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const { login } = useAuth()
  const router = useLocalizedRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<FormData>()

  const password = useRef({})
  password.current = watch('password', '')

  const onSubmit = useCallback(
    async (data: FormData) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users`, {
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        const message = response.statusText || ui('Възникна проблем при създаването на профила.')
        setError(message)
        return
      }

      const redirect = searchParams.get('redirect')

      const timer = setTimeout(() => {
        setLoading(true)
      }, 1000)

      try {
        await login(data)
        clearTimeout(timer)
        if (redirect) router.push(safeReturnHref(redirect, locale))
        else
          router.push(`/account?success=${encodeURIComponent(ui('Профилът е създаден успешно.'))}`)
      } catch (_) {
        clearTimeout(timer)
        setError(ui('Въведените данни не са валидни. Опитайте отново.'))
      }
    },
    [login, router, searchParams, ui, locale],
  )

  return (
    <form className="max-w-lg" onSubmit={handleSubmit(onSubmit)}>
      <Message error={error} />

      <div className="mb-8 flex flex-col gap-6">
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
          <Label htmlFor="password" className="mb-2">
            <CommerceText source={'Нова парола'} />{' '}
          </Label>
          <Input
            id="password"
            {...register('password', { required: ui('Паролата е задължителна.') })}
            type="password"
          />
          {errors.password && <FormError message={errors.password.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="passwordConfirm" className="mb-2">
            <CommerceText source={'Потвърди паролата'} />{' '}
          </Label>
          <Input
            id="passwordConfirm"
            {...register('passwordConfirm', {
              required: ui('Моля, потвърдете паролата.'),
              validate: (value) => value === password.current || ui('Паролите не съвпадат'),
            })}
            type="password"
          />
          {errors.passwordConfirm && <FormError message={errors.passwordConfirm.message} />}
        </FormItem>
      </div>
      <Button
        className="h-12 rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
        disabled={loading}
        type="submit"
        variant="default"
      >
        {loading ? ui('Обработва се') : ui('Създай профил')}
      </Button>

      <div className="mt-8 text-sm text-primary/65">
        <p>
          {ui('Вече имате профил? ')}
          <Link
            className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]"
            href={`/login${allParams}`}
          >
            <CommerceText source={'Вход'} />{' '}
          </Link>
        </p>
      </div>
    </form>
  )
}
