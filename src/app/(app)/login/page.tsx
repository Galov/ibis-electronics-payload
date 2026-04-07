import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import React from 'react'

import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { LoginForm } from '@/components/forms/LoginForm'
import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { redirect } from 'next/navigation'

export default async function Login() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(`/account?warning=${encodeURIComponent('Вече сте влезли в профила си.')}`)
  }

  return (
    <div className="container">
      <div className="mx-auto my-12 max-w-xl bg-muted/20 px-5 py-6 md:px-7 md:py-8">
        <RenderParams />

        <h1 className="mb-4 text-3xl font-normal text-primary/85">Вход</h1>
        <p className="mb-8 text-sm leading-7 text-primary/65">
          Влез в профила си, за да преглеждаш поръчките и настройките си. Ако още нямаш профил,
          можеш да си създадеш нов.
        </p>
        <LoginForm />
      </div>
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Влезте в профила си или създайте нов.',
  path: '/login',
  title: 'Вход',
})
