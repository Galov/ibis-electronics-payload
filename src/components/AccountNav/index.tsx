'use client'
import { useLocale } from '@/i18n/provider'

import { CommerceText } from '@/i18n/CommerceText'

import { Button } from '@/components/ui/button'
import clsx from 'clsx'
import Link from '@/i18n/Link'
import { stripLocale } from '@/i18n/config'
import { usePathname } from 'next/navigation'

type Props = {
  className?: string
}

export const AccountNav: React.FC<Props> = ({ className }) => {
  const pathname = stripLocale(usePathname())

  return (
    <div className={clsx(className)}>
      <ul className="flex flex-col gap-2">
        <li>
          <Button asChild variant="link">
            <Link
              href="/account"
              className={clsx('text-primary/50 hover:text-primary hover:no-underline', {
                'text-primary': pathname === '/account',
              })}
            >
              <CommerceText source={'Настройки на профила'} />{' '}
            </Link>
          </Button>
        </li>

        <li>
          <Button asChild variant="link">
            <Link
              href="/account/addresses"
              className={clsx('text-primary/50 hover:text-primary hover:no-underline', {
                'text-primary': pathname === '/account/addresses',
              })}
            >
              <CommerceText source={'Адреси'} />{' '}
            </Link>
          </Button>
        </li>

        <li>
          <Button
            asChild
            variant="link"
            className={clsx('text-primary/50 hover:text-primary hover:no-underline', {
              'text-primary': pathname === '/orders' || pathname.includes('/orders'),
            })}
          >
            <Link href="/orders">
              <CommerceText source={'Поръчки'} />
            </Link>
          </Button>
        </li>
      </ul>

      <hr className="w-full border-white/5" />

      <Button
        asChild
        variant="link"
        className={clsx('text-primary/50 hover:text-primary hover:no-underline', {
          'text-primary': pathname === '/logout',
        })}
      >
        <Link href="/logout">
          <CommerceText source={'Изход'} />
        </Link>
      </Button>
    </div>
  )
}

export function MobileAccountNav() {
  const locale = useLocale()
  return locale === 'en' ? (
    <AccountNav className="container mt-8 flex flex-wrap gap-4 md:hidden" />
  ) : null
}
