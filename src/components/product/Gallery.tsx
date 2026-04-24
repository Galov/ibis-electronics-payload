'use client'

import type { Product } from '@/payload-types'

import React from 'react'
import Image from 'next/image'

import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { getProductImageAlt, resolveProductImageURL } from '@/utilities/product'

type Props = {
  gallery: NonNullable<Product['images']>
  productTitle?: null | string
}

export const Gallery: React.FC<Props> = ({ gallery, productTitle }) => {
  const [current, setCurrent] = React.useState(0)
  const [, setApi] = React.useState<CarouselApi>()
  const currentImage = gallery[current]
  const currentUrl = resolveProductImageURL(currentImage)

  return (
    <div>
      <div className="relative mb-8 aspect-square w-full overflow-hidden rounded-md border border-black/8 bg-white">
        {currentUrl ? (
            <Image
              alt={getProductImageAlt({
                mediaAlt:
                  currentImage?.image && typeof currentImage.image !== 'string'
                    ? (currentImage.image.alt ?? null)
                    : null,
                imageAlt: currentImage?.alt,
                index: current,
                productTitle,
              })}
            className="object-contain"
            fill
            sizes="(min-width: 1024px) 40rem, 100vw"
            src={currentUrl}
          />
        ) : null}
      </div>

      <Carousel setApi={setApi} className="w-full" opts={{ align: 'start', loop: false }}>
        <CarouselContent>
          {gallery.map((item, i) => {
            const imageUrl = resolveProductImageURL(item)

            if (!imageUrl) return null

            return (
              <CarouselItem
                className="basis-1/5"
                key={`${imageUrl}-${i}`}
                onClick={() => setCurrent(i)}
              >
                <div
                  className={`relative aspect-square overflow-hidden rounded-md border transition ${
                    i === current
                      ? 'border-[rgb(1,55,186)]'
                      : 'border-black/8 hover:border-black/15 dark:border-neutral-800'
                  }`}
                >
                  <Image
                    alt={getProductImageAlt({
                      mediaAlt:
                        item.image && typeof item.image !== 'string' ? (item.image.alt ?? null) : null,
                      imageAlt: item.alt,
                      index: i,
                      productTitle,
                    })}
                    className="object-contain"
                    fill
                    sizes="120px"
                    src={imageUrl}
                  />
                </div>
              </CarouselItem>
            )
          })}
        </CarouselContent>
      </Carousel>
    </div>
  )
}
