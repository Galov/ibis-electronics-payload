import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const PricingSettings: GlobalConfig = {
  slug: 'pricing-settings',
  label: 'Ценообразуване',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Сайт',
  },
  fields: [
    {
      name: 'markupPercent',
      label: 'Надценка (%)',
      type: 'number',
      required: true,
      defaultValue: 15,
      admin: {
        step: 0.01,
        description: 'Използва се за преизчисляване на продажната цена спрямо базовата цена от Ibis Electronics.',
      },
    },
    {
      name: 'recalculatePrices',
      label: 'Преизчисляване',
      type: 'ui',
      admin: {
        components: {
          Field: {
            path: '@/components/admin/RecalculateRetailPricesButton',
            exportName: 'RecalculateRetailPricesButton',
          },
        },
      },
    },
  ],
}
