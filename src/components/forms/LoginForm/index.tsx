'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { useEcommerce } from '@payloadcms/plugin-ecommerce/client/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
}

export const LoginForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const redirect = useRef(searchParams.get('redirect'))
  const { login } = useAuth()
  const { onLogin } = useEcommerce()
  const router = useRouter()
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
            'Влязохте успешно, но количката не можа да се синхронизира. Обновете страницата и проверете количката си.',
          )
        }
        if (redirect?.current) router.push(redirect.current)
        else router.push('/magazin')
      } catch (_) {
        setError('Въведените данни за вход са невалидни. Опитайте отново.')
      }
    },
    [login, onLogin, router],
  )

  return (
    <form className="" onSubmit={handleSubmit(onSubmit)}>
      <Message error={error} />
      <div className="flex flex-col gap-6">
        <FormItem>
          <Label htmlFor="email">Имейл</Label>
          <Input
            id="email"
            type="email"
            {...register('email', { required: 'Имейлът е задължителен.' })}
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="password">Парола</Label>
          <Input
            id="password"
            type="password"
            {...register('password', { required: 'Моля, въведете парола.' })}
          />
          {errors.password && <FormError message={errors.password.message} />}
        </FormItem>

        <div className="mb-6 text-sm text-primary/65">
          <p>
            Забравена парола?{' '}
            <Link
              className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]"
              href={`/forgot-password${allParams}`}
            >
              Натисни тук, за да я смениш
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
            Създай профил
          </Link>
        </Button>
        <Button
          className="h-12 grow rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
          disabled={isLoading}
          type="submit"
          variant="default"
        >
          {isLoading ? 'Обработва се' : 'Продължи'}
        </Button>
      </div>
    </form>
  )
}
