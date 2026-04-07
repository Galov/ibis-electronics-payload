import crypto from 'crypto'
import type { Plugin } from 'payload'
import { ecommercePlugin, EUR } from '@payloadcms/plugin-ecommerce'

import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { ProductsCollection } from '@/collections/Products'
import { manualAdapter } from '@/ecommerce/manualAdapter'

const normalizeMoneyAdminFields = (fields: any[]): any[] => {
  return fields.map((field) => {
    const nextField = { ...field }

    if (Array.isArray(nextField.fields)) {
      nextField.fields = normalizeMoneyAdminFields(nextField.fields)
    }

    if (Array.isArray(nextField.tabs)) {
      nextField.tabs = nextField.tabs.map((tab: any) => ({
        ...tab,
        fields: Array.isArray(tab.fields) ? normalizeMoneyAdminFields(tab.fields) : tab.fields,
      }))
    }

    if (nextField.name === 'amount' || nextField.name === 'subtotal') {
      nextField.admin = {
        ...nextField.admin,
      }

      if (nextField.admin?.components) {
        delete nextField.admin.components
      }
    }

    return nextField
  })
}

const addOrderItemSKUField = (fields: any[]): any[] => {
  return fields.map((field) => {
    const nextField = { ...field }

    if (Array.isArray(nextField.fields)) {
      nextField.fields = addOrderItemSKUField(nextField.fields)
    }

    if (Array.isArray(nextField.tabs)) {
      nextField.tabs = nextField.tabs.map((tab: any) => ({
        ...tab,
        fields: Array.isArray(tab.fields) ? addOrderItemSKUField(tab.fields) : tab.fields,
      }))
    }

    if (nextField.name === 'items' && Array.isArray(nextField.fields)) {
      const hasProductSKUField = nextField.fields.some(
        (itemField: any) => itemField?.name === 'productSKU',
      )

      if (!hasProductSKUField) {
        const productFieldIndex = nextField.fields.findIndex(
          (itemField: any) => itemField?.name === 'product',
        )

        const skuField = {
          name: 'productSKU',
          type: 'text',
          label: 'Код',
          admin: {
            readOnly: true,
          },
        }

        if (productFieldIndex >= 0) {
          nextField.fields = [...nextField.fields]
          nextField.fields.splice(productFieldIndex + 1, 0, skuField)
        } else {
          nextField.fields = [...nextField.fields, skuField]
        }
      }
    }

    return nextField
  })
}

export const plugins: Plugin[] = [
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    customers: {
      slug: 'users',
    },
    currencies: {
      defaultCurrency: 'EUR',
      supportedCurrencies: [EUR],
    },
    payments: {
      paymentMethods: [manualAdapter()],
    },
    products: {
      productsCollectionOverride: ProductsCollection,
      variants: false,
    },
    carts: {
      cartsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        admin: {
          ...defaultCollection.admin,
          group: 'Търговия',
        },
        fields: normalizeMoneyAdminFields(defaultCollection.fields),
        labels: {
          plural: 'Колички',
          singular: 'Количка',
        },
      }),
    },
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        admin: {
          ...defaultCollection.admin,
          group: 'Търговия',
        },
        fields: [
          ...addOrderItemSKUField(normalizeMoneyAdminFields(defaultCollection.fields)),
          {
            name: 'deliveryMethod',
            type: 'select',
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            defaultValue: 'address',
            label: 'Начин на доставка',
            options: [
              {
                label: 'Адрес',
                value: 'address',
              },
              {
                label: 'Офис на Econt',
                value: 'econt-office',
              },
              {
                label: 'Офис на Speedy',
                value: 'speedy-office',
              },
            ],
          },
          {
            name: 'econtOfficeId',
            type: 'text',
            admin: {
              condition: (_, siblingData) => siblingData?.deliveryMethod === 'econt-office',
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Econt офис ID',
          },
          {
            name: 'econtOfficeCode',
            type: 'text',
            admin: {
              condition: (_, siblingData) => siblingData?.deliveryMethod === 'econt-office',
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Econt офис код',
          },
          {
            name: 'econtOfficeName',
            type: 'text',
            admin: {
              condition: (_, siblingData) => siblingData?.deliveryMethod === 'econt-office',
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Име на офис',
          },
          {
            name: 'econtOfficeAddress',
            type: 'textarea',
            admin: {
              condition: (_, siblingData) => siblingData?.deliveryMethod === 'econt-office',
              readOnly: true,
            },
            label: 'Адрес на офис',
          },
          {
            name: 'speedyOfficeId',
            type: 'text',
            admin: {
              condition: (_, siblingData) => siblingData?.deliveryMethod === 'speedy-office',
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Speedy офис ID',
          },
          {
            name: 'speedyOfficeName',
            type: 'text',
            admin: {
              condition: (_, siblingData) => siblingData?.deliveryMethod === 'speedy-office',
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Име на офис',
          },
          {
            name: 'speedyOfficeAddress',
            type: 'textarea',
            admin: {
              condition: (_, siblingData) => siblingData?.deliveryMethod === 'speedy-office',
              readOnly: true,
            },
            label: 'Адрес на офис',
          },
          {
            name: 'shippingFee',
            type: 'number',
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Доставка',
          },
          {
            name: 'customerNotes',
            type: 'textarea',
            admin: {
              readOnly: true,
            },
            label: 'Бележки към поръчката',
          },
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            hooks: {
              beforeValidate: [
                ({ operation, value }) => {
                  if (operation === 'create' || !value) {
                    return crypto.randomUUID()
                  }

                  return value
                },
              ],
            },
          },
        ],
        labels: {
          plural: 'Поръчки',
          singular: 'Поръчка',
        },
      }),
    },
    transactions: {
      transactionsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        admin: {
          ...defaultCollection.admin,
          group: 'Търговия',
        },
        fields: normalizeMoneyAdminFields(defaultCollection.fields),
        labels: {
          plural: 'Транзакции',
          singular: 'Транзакция',
        },
      }),
    },
  }),
]
