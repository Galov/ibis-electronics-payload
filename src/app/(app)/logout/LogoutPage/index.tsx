'use client'

import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import React, { Fragment, useEffect, useState } from 'react'

export const LogoutPage: React.FC = () => {
  const { logout } = useAuth()
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout()
        setSuccess('Излязохте успешно.')
      } catch (_) {
        setError('Вече сте излезли от профила си.')
      }
    }

    void performLogout()
  }, [logout])

  return (
    <Fragment>
      {(error || success) && (
        <div>
          <h1 className="type-page-title mb-4 text-primary">{error || success}</h1>
          <p className="text-sm leading-7 text-primary/65">
            Какво искате да направите сега?
            <Fragment>
              {' '}
              <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/magazin">
                Натиснете тук
              </Link>
              {` за да разгледате каталога.`}
            </Fragment>
            {` За нов вход `}
            <Link className="text-[rgb(1,55,186)] hover:text-[rgb(1,55,186)]" href="/login">
              натиснете тук
            </Link>
            .
          </p>
        </div>
      )}
    </Fragment>
  )
}
