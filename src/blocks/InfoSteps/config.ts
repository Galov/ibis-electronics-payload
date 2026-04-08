import type { Block } from 'payload'

export const InfoSteps: Block = {
  slug: 'infoSteps',
  interfaceName: 'InfoStepsBlock',
  labels: {
    plural: 'Info Steps',
    singular: 'Info Steps',
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
      label: 'Стъпки',
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
          name: 'summary',
          type: 'text',
          label: 'Кратък ред',
        },
        {
          name: 'description',
          type: 'textarea',
          admin: {
            rows: 4,
          },
          label: 'Описание',
        },
      ],
    },
  ],
}
