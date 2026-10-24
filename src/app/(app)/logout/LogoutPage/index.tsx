'use client'

import { CommerceText, useCommerceTranslation } from '@/i18n/CommerceText'

import { useAuth } from '@/providers/Auth'
import Link from '@/i18n/Link'
import React, { Fragment, useEffect, useState } from 'react'

export const LogoutPage: React.FC = () => {
  const ui = useCommerceTranslation()

  const { logout } = useAuth()
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout()
        setSuccess(ui('Излязохте успешно.'))
      } catch (_) {
        setError(ui('Вече сте излезли от профила си.'))
      }
    }

    void performLogout()
  }, [logout, ui])

  return (
    <Fragment>
      {(error || success) && (
        <div>
          <h1 className="type-page-title mb-4 text-primary">{error || success}</h1>
          <p className="text-sm leading-7 text-primary/65">
            <CommerceText source={'Какво искате да направите сега?'} />{' '}
            <Fragment>
              {' '}
              <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/magazin">
                <CommerceText source={'Натиснете тук'} />{' '}
              </Link>
              {ui(' за да разгледате каталога.')}
            </Fragment>
            {ui(' За нов вход ')}
            <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/login">
              <CommerceText source={'натиснете тук'} />{' '}
            </Link>
            .
          </p>
        </div>
      )}
    </Fragment>
  )
}
