'use client'
import { Product } from '@/payload-types'

type Props = {
  product: Product
}

export const StockIndicator: React.FC<Props> = ({ product }) => {
  const stockQuantity = product.inventory || 0

  return (
    <div className="text-sm font-normal text-muted-foreground">
      {stockQuantity === 1 && <p>Остава само 1 в наличност</p>}
      {stockQuantity < 10 && stockQuantity > 1 && <p>Остават само {stockQuantity} в наличност</p>}
      {(stockQuantity === 0 || !stockQuantity) && <p>Изчерпана наличност</p>}
    </div>
  )
}
