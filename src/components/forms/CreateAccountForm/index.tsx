'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  password: string
  passwordConfirm: string
}

export const CreateAccountForm: React.FC = () => {
  const searchParams = useSearchParams()
  const allParams = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const { login } = useAuth()
  const router = useRouter()
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
        const message = response.statusText || 'Възникна проблем при създаването на профила.'
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
        if (redirect) router.push(redirect)
        else router.push(`/account?success=${encodeURIComponent('Профилът е създаден успешно.')}`)
      } catch (_) {
        clearTimeout(timer)
        setError('Въведените данни не са валидни. Опитайте отново.')
      }
    },
    [login, router, searchParams],
  )

  return (
    <form className="max-w-lg" onSubmit={handleSubmit(onSubmit)}>
      <Message error={error} />

      <div className="mb-8 flex flex-col gap-6">
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
          <Label htmlFor="password" className="mb-2">
            Нова парола
          </Label>
          <Input
            id="password"
            {...register('password', { required: 'Паролата е задължителна.' })}
            type="password"
          />
          {errors.password && <FormError message={errors.password.message} />}
        </FormItem>

        <FormItem>
          <Label htmlFor="passwordConfirm" className="mb-2">
            Потвърди паролата
          </Label>
          <Input
            id="passwordConfirm"
            {...register('passwordConfirm', {
              required: 'Моля, потвърдете паролата.',
              validate: (value) => value === password.current || 'Паролите не съвпадат',
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
        {loading ? 'Обработва се' : 'Създай профил'}
      </Button>

      <div className="mt-8 text-sm text-primary/65">
        <p>
          {'Вече имате профил? '}
          <Link
            className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]"
            href={`/login${allParams}`}
          >
            Вход
          </Link>
        </p>
      </div>
    </form>
  )
}
