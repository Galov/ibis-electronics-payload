'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/i18n/provider'
import { ROMANIAN_STOREFRONT } from '@/ecommerce/checkoutDestination'
import {
  rememberedStorefront,
  rememberStorefront,
  STOREFRONT_CHOICE_EVENT,
} from '@/i18n/storefrontPreference'

export function RomanianStoreSuggestion({ eligible }: { eligible: boolean }) {
  const locale = useLocale()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const update = () => setVisible(eligible && !rememberedStorefront())
    update()
    window.addEventListener(STOREFRONT_CHOICE_EVENT, update)
    return () => window.removeEventListener(STOREFRONT_CHOICE_EVENT, update)
  }, [eligible])
  if (!visible) return null
  return (
    <aside
      aria-labelledby="romanian-store-heading"
      className="border-b border-[rgb(1,55,186)]/12 bg-[rgb(248,252,255)]"
    >
      <div className="container flex flex-col gap-5 py-5 xl:flex-row xl:items-center xl:justify-between xl:gap-8 xl:py-6">
        <div className="min-w-0 max-w-[72ch]">
          <p
            id="romanian-store-heading"
            lang="ro"
            className="text-[15px] font-medium leading-6 text-[rgb(1,55,186)]"
          >
            Se pare că ne vizitezi din România. Vrei să accesezi magazinul nostru dedicat României?
          </p>
          <p lang="en" className="mt-1.5 text-sm leading-6 text-[rgb(35,67,112)]">
            It looks like you’re visiting from Romania. Would you like to visit our dedicated
            Romanian store?
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-stretch">
          <Button
            asChild
            className="h-auto min-h-14 whitespace-normal rounded-md bg-[rgb(1,55,186)] px-5 py-2.5 text-center font-normal text-white shadow-none hover:bg-[rgb(1,55,186)]/90 focus-visible:ring-[rgb(1,55,186)]"
          >
            <a href={ROMANIAN_STOREFRONT} onClick={() => rememberStorefront('ro')}>
              <span>
                <span lang="ro" className="block">
                  Mergi la magazinul din România
                </span>
                <span lang="en" className="block text-xs leading-5">
                  Visit Romanian store
                </span>
              </span>
            </a>
          </Button>
          <Button
            variant="outline"
            className="h-auto min-h-14 whitespace-normal rounded-md border-[rgb(1,55,186)]/20 bg-transparent px-5 py-2.5 text-center font-normal text-[rgb(1,55,186)] shadow-none hover:bg-[rgb(1,55,186)]/5 hover:text-[rgb(1,55,186)] focus-visible:ring-[rgb(1,55,186)]"
            onClick={() => {
              rememberStorefront(locale)
              setVisible(false)
            }}
          >
            <span>
              <span lang="ro" className="block">
                Rămâi pe acest site
              </span>
              <span lang="en" className="block text-xs leading-5">
                Stay here
              </span>
            </span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
