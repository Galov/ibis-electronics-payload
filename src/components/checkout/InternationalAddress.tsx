'use client'
import type { InternationalCountry } from '@/ecommerce/internationalDelivery'
import type { Address } from '@/payload-types'
import { useCommerceTranslation } from '@/i18n/CommerceText'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Checkout-only controlled address. Does not save or reuse a BG profile address. */
export function InternationalAddress({
  value,
  country,
  onChange,
}: {
  value?: Partial<Address>
  country: InternationalCountry
  onChange: (address: Partial<Address>) => void
}) {
  const ui = useCommerceTranslation()
  const fields = [
    ['city', 'Град', 'address-level2'],
    ['postalCode', 'Пощенски код', 'postal-code'],
    ['addressLine1', 'Адрес', 'address-line1'],
    ['addressLine2', 'Допълнение към адреса', 'address-line2'],
    ['state', 'Област / регион (по желание)', 'address-level1'],
  ] as const
  return (
    <fieldset className="grid gap-4 rounded-[10px] bg-muted/20 p-5">
      <legend>{ui('Адрес за доставка')}</legend>
      {fields.map(([name, label, autoComplete]) => (
        <div key={name}>
          <Label htmlFor={`international-${name}`}>{ui(label)}</Label>
          <Input
            id={`international-${name}`}
            autoComplete={autoComplete}
            required={['city', 'postalCode', 'addressLine1'].includes(name)}
            value={value?.[name] || ''}
            onChange={(event) => onChange({ ...value, country, [name]: event.target.value })}
          />
        </div>
      ))}
    </fieldset>
  )
}
