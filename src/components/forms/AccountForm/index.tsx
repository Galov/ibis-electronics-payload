'use client'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { useLocalizedRouter } from '@/i18n/navigation'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from '@/payload-types'
import { useAuth } from '@/providers/Auth'
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
  const ui = useCommerceTranslation()

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

  const router = useLocalizedRouter()

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
          toast.success(ui('Профилът е обновен успешно.'))
          setChangePassword(false)
          reset({
            name: json.doc.name,
            email: json.doc.email,
            password: '',
            passwordConfirm: '',
          })
        } else {
          toast.error(ui('Възникна проблем при обновяването на профила.'))
        }
      }
    },
    [user, setUser, reset, ui],
  )

  useEffect(() => {
    if (user === null) {
      router.push(
        `/login?error=${encodeURIComponent(
          ui('Трябва да сте влезли в профила си, за да видите тази страница.'),
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
  }, [user, router, reset, changePassword, ui])

  return (
    <form className="max-w-xl" onSubmit={handleSubmit(onSubmit)}>
      {!changePassword ? (
        <Fragment>
          <div className="mb-8 text-sm leading-7 text-primary/65">
            <p>
              {ui('Промени данните на профила си по-долу или ')}
              <Button
                className="px-0 text-[rgb(1,55,186)] hover:cursor-pointer hover:text-[rgb(1,55,186)]"
                onClick={() => setChangePassword(!changePassword)}
                type="button"
                variant="link"
              >
                <CommerceText source={'натисни тук'} />{' '}
              </Button>
              {ui(' за смяна на паролата.')}
            </p>
          </div>

          <div className="mb-8 flex flex-col gap-6">
            <FormItem>
              <Label htmlFor="email" className="mb-2">
                <CommerceText source={'Имейл адрес'} />{' '}
              </Label>
              <Input
                id="email"
                {...register('email', { required: ui('Моля, въведете имейл.') })}
                type="email"
              />
              {errors.email && <FormError message={errors.email.message} />}
            </FormItem>

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
          </div>
        </Fragment>
      ) : (
        <Fragment>
          <div className="mb-8 text-sm leading-7 text-primary/65">
            <p>
              {ui('Смени паролата си по-долу или ')}
              <Button
                className="px-0 text-[rgb(1,55,186)] hover:cursor-pointer hover:text-[rgb(1,55,186)]"
                onClick={() => setChangePassword(!changePassword)}
                type="button"
                variant="link"
              >
                <CommerceText source={'откажи'} />{' '}
              </Button>
              .
            </p>
          </div>

          <div className="mb-8 flex flex-col gap-6">
            <FormItem>
              <Label htmlFor="password" className="mb-2">
                <CommerceText source={'Нова парола'} />{' '}
              </Label>
              <Input
                id="password"
                {...register('password', { required: ui('Моля, въведете нова парола.') })}
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
                  required: ui('Моля, потвърдете новата парола.'),
                  validate: (value) => value === password.current || ui('Паролите не съвпадат'),
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
          ? ui('Обработва се')
          : changePassword
            ? ui('Смени паролата')
            : ui('Обнови профила')}
      </Button>
    </form>
  )
}
