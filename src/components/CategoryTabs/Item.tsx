'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  href: string
  title: string
}

export function Item({ href, title }: Props) {
  const pathname = usePathname()
  const active = pathname === href
  const DynamicTag = active ? 'p' : Link

  return (
    <li className="mt-2 flex text-sm text-black dark:text-white">
      <DynamicTag
        className={clsx(
          'w-full px-2 py-1 text-sm uppercase text-primary/50 hover:bg-white/5 hover:text-primary',
          {
            'bg-white/5 text-primary': active,
          },
        )}
        href={href}
        prefetch={!active ? false : undefined}
      >
        {title}
      </DynamicTag>
    </li>
  )
}
