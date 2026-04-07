'use client'

import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'
import { manualAdapterClient } from '@/ecommerce/manualAdapter'

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
  return (
    <EcommerceProvider
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
