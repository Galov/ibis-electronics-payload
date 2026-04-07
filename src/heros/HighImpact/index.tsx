'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

type HeroLink = {
  link: Parameters<typeof CMSLink>[0]
}

type HeroProps = {
  links?: HeroLink[] | null
  media?: any
  richText?: any
}

export const HighImpactHero: React.FC<HeroProps> = ({ links, media, richText }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  })

  return (
    <div
      className="relative -mt-[10.4rem] flex items-center justify-center text-white"
      data-theme="dark"
    >
      <div className="container mb-8 z-10 relative flex items-center justify-center">
        <div className="max-w-146 md:text-center">
          {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex md:justify-center gap-4">
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="min-h-[80vh] select-none">
        {media && typeof media === 'object' && (
          <Media fill imgClassName="-z-10 object-cover" priority resource={media} />
        )}
      </div>
    </div>
  )
}
