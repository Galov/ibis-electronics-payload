import { CMSLink } from '@/components/Link'
import React from 'react'

type FooterNavItem = {
  id?: null | string
  link: Parameters<typeof CMSLink>[0]
}

interface Props {
  menu?: null | FooterNavItem[]
}

export function FooterMenu({ menu }: Props) {
  if (!menu?.length) return null

  return (
    <nav>
      <ul>
        {menu.map((item) => {
          return (
            <li key={item.id}>
              <CMSLink appearance="link" {...item.link} />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
