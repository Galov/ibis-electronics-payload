import type { Category, Page, Post, Product } from '@/payload-types'

import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { buildCategoryPath } from '@/utilities/category'
import Link from 'next/link'
import React from 'react'

type CMSLinkType = {
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  internalPath?: '/blog' | null
  label?: string | null
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages' | 'products' | 'categories' | 'posts'
    value: Product | Page | Category | Post | { slug?: string | null } | string | number
  } | null
  size?: ButtonProps['size'] | null
  type?: 'custom' | 'internal' | 'reference' | null
  url?: string | null
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    internalPath,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href =
    type === 'internal'
      ? internalPath
      : type === 'reference' && typeof reference?.value === 'object' && reference.value
      ? reference.relationTo === 'categories'
        ? buildCategoryPath(reference.value as Category)
        : reference.relationTo === 'posts'
          ? reference.value.slug
            ? `/blog/${reference.value.slug}`
            : url
        : reference.value.slug
          ? `${reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''}/${
              reference.value.slug
            }`
          : url
      : url

  if (!href) return null

  const size = appearance === 'link' ? 'clear' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link className={cn(className)} href={href} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
