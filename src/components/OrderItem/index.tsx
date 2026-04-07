import { OrderStatus } from '@/components/OrderStatus'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Order } from '@/payload-types'
import { formatDateTime } from '@/utilities/formatDateTime'
import Link from 'next/link'

type Props = {
  order: Order
}

export const OrderItem: React.FC<Props> = ({ order }) => {
  const itemsLabel = order.items?.length === 1 ? 'артикул' : 'артикула'

  return (
    <div className="flex flex-col gap-8 rounded-[10px] border border-transparent bg-white px-5 py-5 transition duration-300 ease-out hover:border-black/5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3">
        <h3 className="max-w-32 truncate text-xs font-medium uppercase tracking-[0.12em] text-primary/45 sm:max-w-none">{`#${order.id}`}</h3>

        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:gap-5">
          <p className="text-lg font-normal text-primary/80">
            <time dateTime={order.createdAt}>
              {formatDateTime({ date: order.createdAt })}
            </time>
          </p>

          {order.status && <OrderStatus status={order.status} />}
        </div>

        <p className="flex gap-2 text-xs text-primary/65">
          <span>
            {order.items?.length} {itemsLabel}
          </span>
          {order.amount && (
            <>
              <span>•</span>
              <Price as="span" amount={order.amount} currencyCode="EUR" />
            </>
          )}
        </p>
      </div>

      <Button
        variant="outline"
        asChild
        className="self-start rounded-md border-black/10 px-4 text-sm font-normal text-primary/70 hover:border-black/15 hover:bg-black/[0.02] hover:text-primary sm:self-auto"
      >
        <Link href={`/orders/${order.id}`}>Преглед на поръчката</Link>
      </Button>
    </div>
  )
}
