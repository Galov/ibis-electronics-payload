import { getPageLocale, type PageLocaleParams } from '@/i18n/pageLocale'
import { localizeHref } from '@/i18n/config'
import { CommerceText } from '@/i18n/CommerceText'
import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import React from 'react'
import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { CreateAccountForm } from '@/components/forms/CreateAccountForm'
import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import { redirect } from 'next/navigation'

export default async function CreateAccount({ params }: { params?: PageLocaleParams }) {
  const locale = await getPageLocale(params)
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(
      localizeHref(
        `/account?warning=${encodeURIComponent('Вече сте влезли в профила си.')}`,
        locale,
      ),
    )
  }

  return (
    <div className="container">
      <div className="mx-auto my-12 max-w-xl bg-muted/20 px-5 py-6 md:px-7 md:py-8">
        <RenderParams />
        <h1 className="type-page-title mb-4 text-primary">
          <CommerceText source={'Създай профил'} />
        </h1>
        <p className="mb-8 text-sm leading-7 text-primary/65">
          <CommerceText
            source={
              'Създай профил, за да следиш поръчките си и да управляваш настройките и адресите си по-удобно.'
            }
          />{' '}
        </p>
        <CreateAccountForm />
      </div>
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Създайте нов профил или влезте в съществуващия.',
  path: '/create-account',
  title: 'Създай профил',
})
