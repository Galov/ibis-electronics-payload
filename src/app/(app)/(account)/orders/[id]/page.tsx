import type { Order } from '@/payload-types'
import type { Metadata } from 'next'

import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeftIcon } from 'lucide-react'
import { ProductItem } from '@/components/ProductItem'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { OrderStatus } from '@/components/OrderStatus'
import { AddressItem } from '@/components/addresses/AddressItem'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string; accessToken?: string }>
}

export default async function Order({ params, searchParams }: PageProps) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  const { id } = await params
  const { email = '', accessToken = '' } = await searchParams

  let order: Order | null = null

  try {
    const {
      docs: [orderResult],
    } = await payload.find({
      collection: 'orders',
      user,
      overrideAccess: !Boolean(user),
      depth: 2,
      where: {
        and: [
          {
            id: {
              equals: id,
            },
          },
          ...(user
            ? [
                {
                  customer: {
                    equals: user.id,
                  },
                },
              ]
            : [
                {
                  accessToken: {
                    equals: accessToken,
                  },
                },
                ...(email
                  ? [
                      {
                        customerEmail: {
                          equals: email,
                        },
                      },
                    ]
                  : []),
              ]),
        ],
      },
      select: {
        amount: true,
        currency: true,
        items: true,
        customerEmail: true,
        customer: true,
        deliveryMethod: true,
        shippingFee: true,
        speedyOfficeAddress: true,
        speedyOfficeId: true,
        speedyOfficeName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        shippingAddress: true,
      },
    })

    const canAccessAsGuest =
      !user &&
      email &&
      accessToken &&
      orderResult &&
      orderResult.customerEmail &&
      orderResult.customerEmail === email
    const canAccessAsUser =
      user &&
      orderResult &&
      orderResult.customer &&
      (typeof orderResult.customer === 'object'
        ? orderResult.customer.id
        : orderResult.customer) === user.id

    if (orderResult && (canAccessAsGuest || canAccessAsUser)) {
      order = orderResult
    }
  } catch (error) {
    console.error(error)
  }

  if (!order) {
    notFound()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-8">
        {user ? (
          <div className="flex gap-4">
            <Button
              asChild
              className="px-0 text-sm font-normal text-primary/65 hover:bg-transparent hover:text-primary"
              variant="ghost"
            >
              <Link href="/orders">
                <ChevronLeftIcon />
                Всички поръчки
              </Link>
            </Button>
          </div>
        ) : (
          <div></div>
        )}

        <h1 className="bg-[rgb(1,55,186)]/10 px-2.5 py-1 text-sm font-medium uppercase tracking-[0.07em] text-[rgb(1,55,186)]">
          <span className="">{`Поръчка #${order.id}`}</span>
        </h1>
      </div>

      <div className="flex flex-col gap-10 bg-muted/20 px-5 py-6 md:px-7 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-primary/45">Дата</p>
            <p className="text-lg text-primary/80">
              <time dateTime={order.createdAt}>
                {formatDateTime({ date: order.createdAt })}
              </time>
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-primary/45">Общо</p>
            {order.amount && <Price className="text-lg text-primary/80" amount={order.amount} currencyCode="EUR" />}
          </div>

          {typeof order.shippingFee === 'number' ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-primary/45">Доставка</p>
              <Price className="text-lg text-primary/80" amount={order.shippingFee} currencyCode="EUR" />
            </div>
          ) : null}

          {order.status && (
            <div className="grow max-w-1/3">
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-primary/45">Статус</p>
              <OrderStatus className="text-sm" status={order.status} />
            </div>
          )}
        </div>

        {order.items && (
          <div>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.12em] text-primary/45">Артикули</h2>
            <ul className="flex flex-col gap-6">
              {order.items?.map((item, index) => {
                if (typeof item.product === 'string') {
                  return null
                }

                if (!item.product || typeof item.product !== 'object') {
                  return <div key={index}>Този артикул вече не е наличен.</div>
                }

                return (
                  <li key={item.id}>
                    <ProductItem product={item.product} quantity={item.quantity} />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {order.deliveryMethod === 'speedy-office' && (order.speedyOfficeName || order.speedyOfficeAddress) ? (
          <div>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.12em] text-primary/45">
              Офис на Speedy
            </h2>

            <div className="rounded-[10px] border border-transparent bg-white px-5 py-5">
              {order.speedyOfficeName ? (
                <p className="font-medium text-primary/85">{order.speedyOfficeName}</p>
              ) : null}
              {order.speedyOfficeAddress ? (
                <p className="mt-2 text-sm text-primary/60">{order.speedyOfficeAddress}</p>
              ) : null}
              {order.speedyOfficeId ? (
                <p className="mt-2 text-xs text-primary/45">Офис ID: {order.speedyOfficeId}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {order.deliveryMethod !== 'speedy-office' && order.shippingAddress && (
          <div>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.12em] text-primary/45">Адрес за доставка</h2>

            {/* @ts-expect-error - some kind of type hell */}
            <AddressItem address={order.shippingAddress} hideActions />
          </div>
        )}
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return getNoIndexMetadata({
    description: `Детайли за поръчка ${id}.`,
    path: `/orders/${id}`,
    title: `Поръчка ${id}`,
  })
}
