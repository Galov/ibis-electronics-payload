'use client'

import { useTranslate } from '@/i18n/provider'
import { Product } from '@/payload-types'

type Props = {
  product: Product
}

export const StockIndicator: React.FC<Props> = ({ product }) => {
  const t = useTranslate()
  const stockQuantity = product.inventory || 0

  return (
    <div className="text-sm font-normal text-muted-foreground">
      {stockQuantity === 1 && <p>{t('lastOne')}</p>}
      {stockQuantity < 10 && stockQuantity > 1 && <p>{t('fewLeft', { count: stockQuantity })}</p>}
      {(stockQuantity === 0 || !stockQuantity) && <p>{t('outOfStock')}</p>}
    </div>
  )
}
