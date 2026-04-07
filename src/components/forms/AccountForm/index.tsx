'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from '@/payload-types'
import { useAuth } from '@/providers/Auth'
import { useRouter } from 'next/navigation'
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

type FormData = {
  email: string
  name: User['name']
  password: string
  passwordConfirm: string
}

export const AccountForm: React.FC = () => {
  const { setUser, user } = useAuth()
  const [changePassword, setChangePassword] = useState(false)

  const {
    formState: { errors, isLoading, isSubmitting, isDirty },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<FormData>()

  const password = useRef({})
  password.current = watch('password', '')

  const router = useRouter()

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (user) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/${user.id}`, {
          // Make sure to include cookies with fetch
          body: JSON.stringify(data),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'PATCH',
        })

        if (response.ok) {
          const json = await response.json()
          setUser(json.doc)
          toast.success('Профилът е обновен успешно.')
          setChangePassword(false)
          reset({
            name: json.doc.name,
            email: json.doc.email,
            password: '',
            passwordConfirm: '',
          })
        } else {
          toast.error('Възникна проблем при обновяването на профила.')
        }
      }
    },
    [user, setUser, reset],
  )

  useEffect(() => {
    if (user === null) {
      router.push(
        `/login?error=${encodeURIComponent(
          'Трябва да сте влезли в профила си, за да видите тази страница.',
        )}&redirect=${encodeURIComponent('/account')}`,
      )
    }

    // Once user is loaded, reset form to have default values
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        password: '',
        passwordConfirm: '',
      })
    }
  }, [user, router, reset, changePassword])

  return (
    <form className="max-w-xl" onSubmit={handleSubmit(onSubmit)}>
      {!changePassword ? (
        <Fragment>
          <div className="mb-8 text-sm leading-7 text-primary/65">
            <p>
              {'Промени данните на профила си по-долу или '}
              <Button
                className="px-0 text-[rgb(1,55,186)] hover:cursor-pointer hover:text-[rgb(1,55,186)]"
                onClick={() => setChangePassword(!changePassword)}
                type="button"
                variant="link"
              >
                натисни тук
              </Button>
              {' за смяна на паролата.'}
            </p>
          </div>

          <div className="mb-8 flex flex-col gap-6">
            <FormItem>
              <Label htmlFor="email" className="mb-2">
                Имейл адрес
              </Label>
              <Input
                id="email"
                {...register('email', { required: 'Моля, въведете имейл.' })}
                type="email"
              />
              {errors.email && <FormError message={errors.email.message} />}
            </FormItem>

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
          </div>
        </Fragment>
      ) : (
        <Fragment>
          <div className="mb-8 text-sm leading-7 text-primary/65">
            <p>
              {'Смени паролата си по-долу или '}
              <Button
                className="px-0 text-[rgb(1,55,186)] hover:cursor-pointer hover:text-[rgb(1,55,186)]"
                onClick={() => setChangePassword(!changePassword)}
                type="button"
                variant="link"
              >
                откажи
              </Button>
              .
            </p>
          </div>

          <div className="mb-8 flex flex-col gap-6">
            <FormItem>
              <Label htmlFor="password" className="mb-2">
                Нова парола
              </Label>
              <Input
                id="password"
                {...register('password', { required: 'Моля, въведете нова парола.' })}
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
                  required: 'Моля, потвърдете новата парола.',
                  validate: (value) => value === password.current || 'Паролите не съвпадат',
                })}
                type="password"
              />
              {errors.passwordConfirm && <FormError message={errors.passwordConfirm.message} />}
            </FormItem>
          </div>
        </Fragment>
      )}
      <Button
        className="rounded-md bg-[rgb(1,55,186)] px-6 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
        disabled={isLoading || isSubmitting || !isDirty}
        type="submit"
        variant="default"
      >
        {isLoading || isSubmitting
          ? 'Обработва се'
          : changePassword
            ? 'Смени паролата'
            : 'Обнови профила'}
      </Button>
    </form>
  )
}
