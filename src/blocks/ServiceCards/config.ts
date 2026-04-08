import type { Block } from 'payload'

export const ServiceCards: Block = {
  slug: 'serviceCards',
  interfaceName: 'ServiceCardsBlock',
  labels: {
    plural: 'Service Cards',
    singular: 'Service Cards',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      label: 'Надзаглавие',
    },
    {
      name: 'title',
      type: 'text',
      label: 'Заглавие',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        rows: 3,
      },
      label: 'Описание',
    },
    {
      name: 'items',
      type: 'array',
      label: 'Карти',
      minRows: 1,
      required: true,
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Заглавие',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
          admin: {
            rows: 4,
          },
          label: 'Описание',
          required: true,
        },
        {
          name: 'tags',
          type: 'array',
          label: 'Тагове',
          fields: [
            {
              name: 'label',
              type: 'text',
              label: 'Таг',
              required: true,
            },
          ],
        },
        {
          name: 'highlights',
          type: 'array',
          label: 'Акценти',
          fields: [
            {
              name: 'text',
              type: 'text',
              label: 'Ред',
              required: true,
            },
          ],
        },
      ],
    },
  ],
}
