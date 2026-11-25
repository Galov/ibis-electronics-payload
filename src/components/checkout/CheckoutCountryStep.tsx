'use client'

import { useLocale } from '@/i18n/provider'
import { useCommerceTranslation } from '@/i18n/CommerceText'
import { getCheckoutDestination, type CheckoutCountry } from '@/ecommerce/checkoutDestination'
import {
  internationalDestinations,
  isInternationalCountry,
} from '@/ecommerce/internationalDelivery'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function CheckoutCountryStep({
  country,
  onChange,
}: {
  country: CheckoutCountry
  onChange: (country: CheckoutCountry) => void
}) {
  const ui = useCommerceTranslation()
  const locale = useLocale()
  const countryNames = new Intl.DisplayNames([locale], { type: 'region' })
  const destination = getCheckoutDestination(country)
  return (
    <section
      className="rounded-[10px] bg-muted/20 px-5 py-5 md:px-6"
      aria-labelledby="delivery-country-title"
    >
      <h2 id="delivery-country-title" className="type-section-title mb-5 text-primary/85">
        {ui('Държава на доставка')}
      </h2>
      <Label htmlFor="deliveryCountry">{ui('Избери държава')}</Label>
      <select
        id="deliveryCountry"
        value={country}
        onChange={(event) => {
          const code = event.target.value
          onChange(code === 'BG' || code === 'RO' || isInternationalCountry(code) ? code : '')
        }}
        className="mt-2 h-12 w-full rounded-md border bg-white px-4 text-sm text-primary md:max-w-md"
      >
        <option value="">{ui('Избери държава')}</option>
        <option value="BG">{ui('България')}</option>
        <option value="RO">{ui('Румъния')}</option>
        {Object.entries(internationalDestinations).map(([code, destination]) => (
          <option key={code} value={code}>
            {countryNames.of(code) || destination.name}
          </option>
        ))}
      </select>
      {destination.kind === 'redirect' ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm leading-6 text-primary/65">
            {ui(
              'За доставки в Румъния използвайте румънския ни магазин. Количката не се прехвърля автоматично между двата сайта.',
            )}
          </p>
          <Button asChild>
            <a href={destination.url}>{ui('Към румънския магазин')}</a>
          </Button>
        </div>
      ) : destination.kind === 'international' ? (
        <p className="mt-4 text-sm">
          {ui('Само онлайн плащане с карта')} · {destination.shippingFee.toFixed(2)} €
        </p>
      ) : destination.kind === 'unavailable' ? (
        <p className="mt-4 text-sm leading-6 text-primary/65">
          {ui(
            'Изберете държава, за да видите наличните доставки и начини на плащане. Други дестинации ще бъдат добавени след потвърждение на условията за доставка.',
          )}
        </p>
      ) : null}
    </section>
  )
}
