'use client'

import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'
import { manualAdapterClient } from '@/ecommerce/manualAdapter'
import { useAuth } from '@/providers/Auth'

const ecommerceCurrenciesConfig = {
  defaultCurrency: 'EUR',
  supportedCurrencies: [
    {
      code: 'EUR',
      decimals: 2,
      label: 'Euro',
      symbol: '€',
    },
  ],
}

const CommerceProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const authState = user ? `auth-${user.id}` : user === null ? 'guest' : 'loading'

  return (
    <EcommerceProvider
      key={authState}
      enableVariants={false}
      currenciesConfig={ecommerceCurrenciesConfig}
      api={{
        cartsFetchQuery: {
          depth: 2,
          populate: {
            products: {
              images: true,
              inventory: true,
              price: true,
              priceInEUR: true,
              priceInUSD: true,
              published: true,
              slug: true,
              title: true,
            },
          },
        },
      }}
      paymentMethods={[manualAdapterClient()]}
      syncLocalStorage={user === null ? { key: 'cart-eur' } : false}
    >
      {children}
    </EcommerceProvider>
  )
}

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <CommerceProviders>{children}</CommerceProviders>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
