import { OrderStatus as StatusOptions } from '@/payload-types'
import { cn } from '@/utilities/cn'

type Props = {
  status: StatusOptions
  className?: string
}

export const OrderStatus: React.FC<Props> = ({ status, className }) => {
  if (!status) {
    return null
  }

  const labelByStatus: Record<string, string> = {
    cancelled: 'Отказана',
    completed: 'Завършена',
    processing: 'Обработва се',
  }

  return (
    <div
      className={cn(
        'w-fit rounded-md px-2.5 py-1 text-xs font-medium uppercase tracking-[0.08em]',
        className,
        {
          'bg-amber-100 text-amber-800': status === 'processing',
          'bg-emerald-100 text-emerald-800': status === 'completed',
          'bg-red-100 text-red-800': status === 'cancelled',
        },
      )}
    >
      {labelByStatus[status] || status}
    </div>
  )
}
