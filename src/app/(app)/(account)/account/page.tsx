import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { AccountForm } from '@/components/forms/AccountForm'
import { Order } from '@/payload-types'
import { OrderItem } from '@/components/OrderItem'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let orders: Order[] | null = null

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Моля, влезте в профила си, за да достъпите настройките му.')}`,
    )
  }

  try {
    const ordersResult = await payload.find({
      collection: 'orders',
      limit: 5,
      user,
      overrideAccess: false,
      pagination: false,
      where: {
        customer: {
          equals: user?.id,
        },
      },
    })

    orders = ordersResult?.docs || []
  } catch (_error) {
    // when deploying this template on Payload Cloud, this page needs to build before the APIs are live
    // so swallow the error here and simply render the page with fallback data where necessary
    // in production you may want to redirect to a 404  page or at least log the error somewhere
    // console.error(error)
  }

  return (
    <>
      <div className="bg-muted/20 px-5 py-6 md:px-7 md:py-8">
        <h1 className="mb-8 text-3xl font-normal text-primary/85">Настройки на профила</h1>
        <AccountForm />
      </div>

      <div className="bg-muted/20 px-5 py-6 md:px-7 md:py-8">
        <h2 className="mb-8 text-3xl font-normal text-primary/85">Последни поръчки</h2>

        <div className="mb-8 max-w-none text-primary/65">
          <p>
            Това са последните поръчки, които сте направили. С добавянето на нови поръчки те ще
            се появяват в този списък.
          </p>
        </div>

        {(!orders || !Array.isArray(orders) || orders?.length === 0) && (
          <p className="mb-8">Нямате поръчки.</p>
        )}

        {orders && orders.length > 0 && (
          <ul className="mb-8 flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.id}>
                <OrderItem order={order} />
              </li>
            ))}
          </ul>
        )}

        <Button asChild variant="default">
          <Link href="/orders">Виж всички поръчки</Link>
        </Button>
      </div>
    </>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Управление на профила и последните поръчки.',
  path: '/account',
  title: 'Профил',
})
