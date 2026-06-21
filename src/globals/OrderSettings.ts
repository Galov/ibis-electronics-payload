import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const OrderSettings: GlobalConfig = {
  slug: 'order-settings',
  label: 'Настройки на поръчките',
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    group: 'Сайт',
  },
  fields: [
    {
      name: 'freeShippingThreshold',
      label: 'Безплатна доставка над сума',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Ако сумата на продуктите в количката достигне или надвиши тази стойност в евро, доставката става безплатна.',
      },
    },
    {
      name: 'revolutPayEnabled',
      label: 'Покажи онлайн плащане в checkout',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Когато е включено, клиентите ще виждат онлайн плащане чрез защитения checkout на Revolut.',
      },
    },
    {
      name: 'notificationRecipients',
      label: 'Получатели на имейл при нова поръчка',
      type: 'array',
      admin: {
        description: 'На тези имейл адреси ще се изпраща известие при успешно направена поръчка.',
      },
      fields: [
        {
          name: 'email',
          label: 'Имейл адрес',
          type: 'email',
          required: true,
        },
      ],
      labels: {
        plural: 'Получатели',
        singular: 'Получател',
      },
    },
    {
      name: 'ordersReport',
      label: 'Справка и експорт',
      type: 'ui',
      admin: {
        components: {
          Field: {
            path: '@/components/admin/OrdersReportField',
            exportName: 'OrdersReportField',
          },
        },
      },
    },
  ],
}
