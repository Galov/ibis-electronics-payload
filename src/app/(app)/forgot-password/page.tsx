import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import React from 'react'

import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm'
type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  await searchParams

  return (
    <div className="container">
      <div className="mx-auto my-12 max-w-xl bg-muted/20 px-5 py-6 md:px-7 md:py-8">
        <RenderParams />
        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-normal text-primary/85">Забравена парола</h1>
          <p className="text-sm leading-7 text-primary/65">
            Въведете имейла си и ще получите линк за създаване на нова парола.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Въведете имейла си, за да възстановите паролата.',
  path: '/forgot-password',
  title: 'Забравена парола',
})
