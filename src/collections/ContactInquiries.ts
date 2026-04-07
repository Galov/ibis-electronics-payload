import { adminOnly } from '@/access/adminOnly'
import type { CollectionConfig } from 'payload'

export const ContactInquiries: CollectionConfig = {
  slug: 'contact-inquiries',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
    group: 'Комуникация',
    defaultColumns: ['createdAt', 'name', 'email', 'phone'],
  },
  labels: {
    plural: 'Запитвания',
    singular: 'Запитване',
  },
  fields: [
    {
      name: 'name',
      label: 'Име',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      label: 'Имейл',
      type: 'email',
      required: true,
    },
    {
      name: 'phone',
      label: 'Телефон',
      type: 'text',
    },
    {
      name: 'message',
      label: 'Съобщение',
      type: 'textarea',
      admin: {
        rows: 8,
      },
      required: true,
    },
    {
      name: 'privacyAccepted',
      label: 'Съгласие с политиката за поверителност',
      type: 'checkbox',
      required: true,
    },
  ],
}
