import type { Media } from '@/payload-types'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

type BannerData = {
  image?: Media | null | string
  openInNewTab?: boolean | null
  url?: null | string
}

type Props = {
  banner?: BannerData | null
  className?: string
}

export const ShopBanner: React.FC<Props> = ({ banner, className }) => {
  if (!banner?.image || typeof banner.image === 'string') {
    return null
  }

  const image = banner.image

  if (!image.url) {
    return null
  }

  const imageNode = (
    <div
      className={`overflow-hidden rounded-[8px] bg-[rgb(248,250,252)] shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${
        className || ''
      }`}
    >
      <Image
        alt={image.alt || ''}
        className="h-auto w-full"
        height={image.height || 480}
        sizes="(min-width: 1280px) 1100px, (min-width: 1024px) 900px, 100vw"
        src={image.url}
        width={image.width || 1600}
      />
    </div>
  )

  if (!banner.url?.trim()) {
    return imageNode
  }

  return (
    <Link
      className="block transition hover:opacity-95"
      href={banner.url}
      rel={banner.openInNewTab ? 'noreferrer noopener' : undefined}
      target={banner.openInNewTab ? '_blank' : undefined}
    >
      {imageNode}
    </Link>
  )
}
