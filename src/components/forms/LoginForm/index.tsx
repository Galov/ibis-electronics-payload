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
import { useEcommerce } from '@payloadcms/plugin-ecommerce/client/react'
import Link from '@/i18n/Link'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
}

export const LoginForm: React.FC = () => {
  const locale = useLocale()
  const ui = useCommerceTranslation()

  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const redirect = useRef(searchParams.get('redirect'))
  const { login } = useAuth()
  const { onLogin } = useEcommerce()
  const router = useLocalizedRouter()
  const [error, setError] = React.useState<null | string>(null)

  const {
    formState: { errors, isLoading },
    handleSubmit,
    register,
  } = useForm<FormData>()

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        await login(data)
        try {
          await onLogin()
        } catch {
          setError(
            ui(
              'Влязохте успешно, но количката не можа да се синхронизира. Обновете страницата и проверете количката си.',
            ),
          )
        }
        if (redirect?.current) router.push(safeReturnHref(redirect.current, locale))
        else router.push('/magazin')
      } catch (_) {
        setError(ui('Въведените данни за вход са невалидни. Опитайте отново.'))
      }
    },
    [login, onLogin, router, ui, locale],
  )

  return (
    <form className="" onSubmit={handleSubmit(onSubmit)}>
      <Message error={error} />
      <div className="flex flex-col gap-6">
        <FormItem>
          <Label htmlFor="email">
            <CommerceText source={'Имейл'} />
          </Label>
          <Input
            id="email"
            type="email"
            {...register('email', { required: ui('Имейлът е задължителен.') })}
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="password">
            <CommerceText source={'Парола'} />
          </Label>
          <Input
            id="password"
            type="password"
            {...register('password', { required: ui('Моля, въведете парола.') })}
          />
          {errors.password && <FormError message={errors.password.message} />}
        </FormItem>

        <div className="mb-6 text-sm text-primary/65">
          <p>
            <CommerceText source={'Забравена парола?'} />{' '}
            <Link
              className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]"
              href={`/forgot-password${allParams}`}
            >
              <CommerceText source={'Натисни тук, за да я смениш'} />{' '}
            </Link>
          </p>
        </div>
      </div>

      <div className="flex justify-between gap-4">
        <Button
          asChild
          className="h-12 max-w-[50%] rounded-md border-black/10 px-5 text-sm font-normal text-primary/70 hover:border-black/15 hover:bg-black/[0.02] hover:text-primary"
          variant="outline"
        >
          <Link href={`/create-account${allParams}`} className="grow">
            <CommerceText source={'Създай профил'} />{' '}
          </Link>
        </Button>
        <Button
          className="h-12 grow rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
          disabled={isLoading}
          type="submit"
          variant="default"
        >
          {isLoading ? ui('Обработва се') : ui('Продължи')}
        </Button>
      </div>
    </form>
  )
}
