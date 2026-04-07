import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import React from 'react'

import { LogoutPage } from './LogoutPage'

export default async function Logout() {
  return (
    <div className="container max-w-lg my-16">
      <LogoutPage />
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Излязохте от профила си.',
  path: '/logout',
  title: 'Изход',
})
