import { Price } from '@/components/Price'
import { Product } from '@/payload-types'
import { getProductPrimaryImage } from '@/utilities/product'
import Image from 'next/image'
import Link from 'next/link'

type Props = {
  product: Product
  style?: 'compact' | 'default'
  quantity?: number
  /**
   * Force all formatting to a particular currency.
   */
  currencyCode?: string
}

export const ProductItem: React.FC<Props> = ({
  product,
  quantity,
  currencyCode,
}) => {
  const { title } = product
  const image = getProductPrimaryImage(product)
  const itemPrice = product.price
  const itemURL = `/products/${product.slug}`

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 items-stretch justify-stretch border border-black/8 bg-white p-2">
        <div className="relative h-full w-full">
          {image?.url && (
            <Image alt={image.alt} className="object-contain" fill sizes="80px" src={image.url} />
          )}
        </div>
      </div>
      <div className="flex grow justify-between items-center">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium text-primary/85">
            <Link href={itemURL}>{title}</Link>
          </p>
          <div className="text-sm text-primary/55">
            {'x'}
            {quantity}
          </div>
        </div>

        {itemPrice && quantity && (
          <div className="text-right">
            <p className="text-base font-medium text-primary/75">Междинна сума</p>
            <Price
              className="text-sm text-primary/55"
              amount={itemPrice * quantity}
              currencyCode={currencyCode || 'EUR'}
            />
          </div>
        )}
      </div>
    </div>
  )
}
