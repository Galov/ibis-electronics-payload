'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCommerceTranslation } from '@/i18n/CommerceText'
import Link from '@/i18n/Link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/forms/FormError'

export function ResetPasswordForm({ token }: { token: string }) {
  const ui = useCommerceTranslation()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string; confirm: string }>()
  if (done)
    return (
      <div role="status">
        <p>{ui('Паролата е сменена. Влезте с новата си парола.')}</p>
        <Link href="/login" className="underline">
          {ui('Вход')}
        </Link>
      </div>
    )
  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async ({ password }) => {
        setError('')
        try {
          const response = await fetch('/api/users/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password }),
          })
          if (!response.ok) throw new Error('reset failed')
          setDone(true)
        } catch {
          setError(ui('Линкът е невалиден или е изтекъл. Поискайте нов линк.'))
        }
      })}
    >
      <div>
        <Label htmlFor="reset-password">{ui('Нова парола')}</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          {...register('password', { required: ui('Моля, въведете нова парола.') })}
        />
        <FormError message={errors.password?.message} />
      </div>
      <div>
        <Label htmlFor="reset-confirm">{ui('Потвърди паролата')}</Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          {...register('confirm', {
            required: ui('Моля, потвърдете паролата.'),
            validate: (value) => value === watch('password') || ui('Паролите не съвпадат'),
          })}
        />
        <FormError message={errors.confirm?.message} />
      </div>
      {error ? (
        <p role="alert">
          {error}{' '}
          <Link href="/forgot-password" className="underline">
            {ui('Поискай нов линк')}
          </Link>
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {ui('Възстанови паролата')}
      </Button>
    </form>
  )
}
