'use client'
import React from 'react'

type BaseProps = {
  className?: string
  currencyCodeClassName?: string
  as?: 'span' | 'p'
}

type PriceFixed = {
  amount: number
  currencyCode?: string
  highestAmount?: never
  lowestAmount?: never
}

type PriceRange = {
  amount?: never
  currencyCode?: string
  highestAmount: number
  lowestAmount: number
}

type Props = BaseProps & (PriceFixed | PriceRange)

export const Price = ({
  amount,
  className,
  highestAmount,
  lowestAmount,
  currencyCode = 'EUR',
  as = 'p',
}: Props & React.ComponentProps<'p'>) => {
  const Element = as
  const formatCurrency = (value: number, code = currencyCode) =>
    new Intl.NumberFormat('bg-BG', {
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: 'currency',
    }).format(value)

  if (typeof amount === 'number') {
    return (
      <Element className={className} suppressHydrationWarning>
        {formatCurrency(amount)}
      </Element>
    )
  }

  if (highestAmount && highestAmount !== lowestAmount) {
    return (
      <Element className={className} suppressHydrationWarning>
        {`${formatCurrency(lowestAmount)} - ${formatCurrency(highestAmount)}`}
      </Element>
    )
  }

  if (lowestAmount) {
    return (
      <Element className={className} suppressHydrationWarning>
        {formatCurrency(lowestAmount)}
      </Element>
    )
  }

  return null
}
