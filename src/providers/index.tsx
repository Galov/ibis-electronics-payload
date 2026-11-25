'use client'

import { useLocale } from '@/i18n/provider'
import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { SonnerProvider } from '@/providers/Sonner'
import { manualAdapterClient } from '@/ecommerce/manualAdapterClient'
import { revolutAdapterClient } from '@/ecommerce/revolutAdapterClient'

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
  const locale = useLocale()
  const cartsFetchQuery = React.useMemo(
    () =>
      ({
        locale,
        fallbackLocale: 'bg',
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
      }) as const,
    [locale],
  )
  return (
    <EcommerceProvider
      enableVariants={false}
      currenciesConfig={ecommerceCurrenciesConfig}
      api={{
        cartsFetchQuery,
      }}
      paymentMethods={[manualAdapterClient(), revolutAdapterClient()]}
      syncLocalStorage={{
        key: 'cart-eur',
      }}
    >
      {children}
    </EcommerceProvider>
  )
}

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <AuthProvider>
      <HeaderThemeProvider>
        <SonnerProvider />
        <CommerceProviders>{children}</CommerceProviders>
      </HeaderThemeProvider>
    </AuthProvider>
  )
}
