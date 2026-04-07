import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'

import { OrderItem } from '@/components/OrderItem'
import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

export default async function Orders() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let orders: Order[] | null = null

  if (!user) {
    redirect(`/login?warning=${encodeURIComponent('Моля, влезте в профила си, за да достъпите поръчките си.')}`)
  }

  try {
    const ordersResult = await payload.find({
      collection: 'orders',
      limit: 0,
      pagination: false,
      user,
      overrideAccess: false,
      where: {
        customer: {
          equals: user?.id,
        },
      },
    })

    orders = ordersResult?.docs || []
  } catch (_error) {}

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-normal text-primary/85">Поръчки</h1>
      </div>

      <div className="bg-muted/20 px-5 py-6 md:px-7 md:py-8">
        {(!orders || !Array.isArray(orders) || orders?.length === 0) && (
          <p className="text-primary/65">Нямате поръчки.</p>
        )}

        {orders && orders.length > 0 && (
          <ul className="flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.id}>
                <OrderItem order={order} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export const metadata: Promise<Metadata> = getNoIndexMetadata({
  description: 'Вашите поръчки.',
  path: '/orders',
  title: 'Поръчки',
})
