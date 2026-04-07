import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { adminOrSelf } from '@/access/adminOrSelf'
import { publicAccess } from '@/access/publicAccess'
import { checkRole } from '@/access/utilities'

import { ensureFirstUserIsAdmin } from './hooks/ensureFirstUserIsAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => checkRole(['admin'], user),
    create: publicAccess,
    delete: adminOnly,
    read: adminOrSelf,
    unlock: adminOnly,
    update: adminOrSelf,
  },
  admin: {
    group: 'Потребители',
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  labels: {
    plural: 'Потребители',
    singular: 'Потребител',
  },
  auth: {
    tokenExpiration: 1209600,
  },
  fields: [
    {
      name: 'name',
      label: 'Име',
      type: 'text',
    },
    {
      name: 'roles',
      label: 'Роли',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
      options: [
        {
          label: 'Клиент',
          value: 'customer',
        },
        {
          label: 'Администратор',
          value: 'admin',
        },
      ],
    },
    {
      name: 'orders',
      label: 'Поръчки',
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'amount', 'currency', 'items'],
      },
    },
    {
      name: 'cart',
      label: 'Количка',
      type: 'join',
      collection: 'carts',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'subtotal', 'currency', 'items'],
      },
    },
    {
      name: 'addresses',
      label: 'Адреси',
      type: 'join',
      collection: 'addresses',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id'],
      },
    },
  ],
}
