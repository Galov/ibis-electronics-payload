import crypto from 'crypto'
import type { Plugin } from 'payload'
import { ecommercePlugin, EUR } from '@payloadcms/plugin-ecommerce'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'

import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { ProductsCollection } from '@/collections/Products'
import { manualAdapter } from '@/ecommerce/manualAdapter'
import { revolutAdapter } from '@/ecommerce/revolutAdapter'

const hasR2Config = Boolean(
  process.env.R2_BUCKET &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT,
)

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
        readOnly: true,
      }

      if (nextField.admin?.components) {
        delete nextField.admin.components
      }
    }

    return nextField
  })
}

const addLineItemSnapshotFields = (fields: any[]): any[] => {
  return fields.map((field) => {
    const nextField = { ...field }

    if (Array.isArray(nextField.fields)) {
      nextField.fields = addLineItemSnapshotFields(nextField.fields)
    }

    if (Array.isArray(nextField.tabs)) {
      nextField.tabs = nextField.tabs.map((tab: any) => ({
        ...tab,
        fields: Array.isArray(tab.fields) ? addLineItemSnapshotFields(tab.fields) : tab.fields,
      }))
    }

    if (nextField.name === 'items' && Array.isArray(nextField.fields)) {
      const hasProductSKUField = nextField.fields.some(
        (itemField: any) => itemField?.name === 'productSKU',
      )
      const hasProductUnitPriceField = nextField.fields.some(
        (itemField: any) => itemField?.name === 'productUnitPrice',
      )

      const fieldsToInsert = []

      if (!hasProductSKUField) {
        fieldsToInsert.push({
          name: 'productSKU',
          type: 'text',
          label: 'Код',
          admin: {
            readOnly: true,
          },
        })
      }

      if (!hasProductUnitPriceField) {
        fieldsToInsert.push({
          name: 'productUnitPrice',
          type: 'number',
          label: 'Ед. цена',
          admin: {
            readOnly: true,
          },
        })
      }

      if (fieldsToInsert.length > 0) {
        const productFieldIndex = nextField.fields.findIndex(
          (itemField: any) => itemField?.name === 'product',
        )

        nextField.fields = [...nextField.fields]

        if (productFieldIndex >= 0) {
          nextField.fields.splice(productFieldIndex + 1, 0, ...fieldsToInsert)
        } else {
          nextField.fields.push(...fieldsToInsert)
        }
      }
    }

    return nextField
  })
}

const applyReadOnlyOrderItemsField = (fields: any[]): any[] => {
  return fields.map((field) => {
    const nextField = { ...field }

    if (Array.isArray(nextField.fields)) {
      nextField.fields = applyReadOnlyOrderItemsField(nextField.fields)
    }

    if (Array.isArray(nextField.tabs)) {
      nextField.tabs = nextField.tabs.map((tab: any) => ({
        ...tab,
        fields: Array.isArray(tab.fields) ? applyReadOnlyOrderItemsField(tab.fields) : tab.fields,
      }))
    }

    if (nextField.name === 'items') {
      nextField.admin = {
        ...nextField.admin,
        components: {
          ...nextField.admin?.components,
          Field: {
            path: '@/components/admin/OrderItemsReadOnlyField',
            exportName: 'OrderItemsReadOnlyField',
          },
        },
        readOnly: true,
      }
    }

    return nextField
  })
}

const transactionShippingAddressFields = [
  {
    name: 'title',
    type: 'text',
    label: 'Заглавие',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'firstName',
    type: 'text',
    label: 'Име',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'lastName',
    type: 'text',
    label: 'Фамилия',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'company',
    type: 'text',
    label: 'Компания',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'addressLine1',
    type: 'text',
    label: 'Адрес 1',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'addressLine2',
    type: 'text',
    label: 'Адрес 2',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'city',
    type: 'text',
    label: 'Град',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'state',
    type: 'text',
    label: 'Област',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'postalCode',
    type: 'text',
    label: 'Пощенски код',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'country',
    type: 'text',
    label: 'Държава',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'phone',
    type: 'text',
    label: 'Телефон',
    admin: {
      readOnly: true,
    },
  },
]

const appendTransactionCheckoutSnapshotFields = (fields: any[]): any[] => [
  ...fields,
  {
    name: 'customerNotes',
    type: 'textarea',
    label: 'Бележки към поръчката',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'deliveryMethod',
    type: 'select',
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
    admin: {
      position: 'sidebar',
      readOnly: true,
    },
  },
  {
    name: 'shippingFee',
    type: 'number',
    label: 'Цена на доставка',
    admin: {
      hidden: true,
      position: 'sidebar',
      readOnly: true,
    },
  },
  {
    name: 'shippingAddress',
    type: 'group',
    label: 'Адрес за доставка',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'address',
    },
    fields: transactionShippingAddressFields,
  },
  ...deliveryDetailFields,
]

const clarifyOrderCustomerField = (fields: any[]): any[] => {
  return fields.map((field) => {
    const nextField = { ...field }

    if (Array.isArray(nextField.fields)) {
      nextField.fields = clarifyOrderCustomerField(nextField.fields)
    }

    if (Array.isArray(nextField.tabs)) {
      nextField.tabs = nextField.tabs.map((tab: any) => ({
        ...tab,
        fields: Array.isArray(tab.fields) ? clarifyOrderCustomerField(tab.fields) : tab.fields,
      }))
    }

    if (nextField.name === 'customer') {
      nextField.label = 'Регистриран клиент'
      nextField.admin = {
        ...nextField.admin,
        readOnly: true,
      }
    }

    return nextField
  })
}

const clarifyOrderPaymentMethodField = (fields: any[]): any[] => {
  return fields.map((field) => {
    const nextField = { ...field }

    if (Array.isArray(nextField.fields)) {
      nextField.fields = clarifyOrderPaymentMethodField(nextField.fields)
    }

    if (Array.isArray(nextField.tabs)) {
      nextField.tabs = nextField.tabs.map((tab: any) => ({
        ...tab,
        fields: Array.isArray(tab.fields) ? clarifyOrderPaymentMethodField(tab.fields) : tab.fields,
      }))
    }

    if (nextField.name === 'paymentMethod') {
      nextField.label = 'Начин на плащане'
      nextField.admin = {
        ...nextField.admin,
        position: 'sidebar',
        readOnly: true,
      }

      if (Array.isArray(nextField.options)) {
        nextField.options = nextField.options.map((option: any) => {
          if (option?.value === 'manual') {
            return {
              ...option,
              label: 'Наложен платеж',
            }
          }

          if (option?.value === 'revolut') {
            return {
              ...option,
              label: 'Плащане онлайн',
            }
          }

          return option
        })
      }
    }

    return nextField
  })
}

const hasAdminValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value !== null && value !== undefined
}

const hideEmptyShippingAddressFields = (fields: any[]): any[] => {
  return fields.map((field) => {
    const nextField = { ...field }

    if (nextField.name === 'firstName' || nextField.name === 'lastName') {
      nextField.admin = {
        ...nextField.admin,
        hidden: true,
      }

      return nextField
    }

    if (nextField.name === 'title') {
      nextField.admin = {
        ...nextField.admin,
        hidden: true,
      }

      return nextField
    }

    nextField.admin = {
      ...nextField.admin,
      condition: (_: unknown, siblingData: Record<string, unknown> = {}) =>
        hasAdminValue(siblingData[nextField.name]),
    }

    return nextField
  })
}

const orderShippingNameField = {
  name: 'orderShippingName',
  type: 'ui',
  admin: {
    components: {
      Field: {
        path: '@/components/admin/OrderShippingNameField',
        exportName: 'OrderShippingNameField',
      },
    },
  },
}

const customerNotesField = {
  name: 'customerNotes',
  type: 'textarea',
  admin: {
    readOnly: true,
  },
  label: 'Бележки към поръчката',
}

const deliveryDetailFields = [
  {
    name: 'econtOfficeId',
    type: 'text',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'econt-office',
      readOnly: true,
    },
    label: 'Econt офис ID',
  },
  {
    name: 'econtOfficeCode',
    type: 'text',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'econt-office',
      readOnly: true,
    },
    label: 'Econt офис код',
  },
  {
    name: 'econtOfficeName',
    type: 'text',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'econt-office',
      readOnly: true,
    },
    label: 'Име на офис',
  },
  {
    name: 'econtOfficeAddress',
    type: 'textarea',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'econt-office',
      readOnly: true,
    },
    label: 'Адрес на офис',
  },
  {
    name: 'speedyOfficeId',
    type: 'text',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'speedy-office',
      readOnly: true,
    },
    label: 'Speedy офис ID',
  },
  {
    name: 'speedyOfficeName',
    type: 'text',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'speedy-office',
      readOnly: true,
    },
    label: 'Име на офис',
  },
  {
    name: 'speedyOfficeAddress',
    type: 'textarea',
    admin: {
      condition: (_: unknown, siblingData: any) => siblingData?.deliveryMethod === 'speedy-office',
      readOnly: true,
    },
    label: 'Адрес на офис',
  },
]

const arrangeOrderAdminTabs = (fields: any[]): any[] => {
  return fields.map((field) => {
    if (field.type !== 'tabs' || !Array.isArray(field.tabs)) {
      return field
    }

    return {
      ...field,
      tabs: field.tabs.map((tab: any, index: number) => {
        if (!Array.isArray(tab.fields)) return tab

        if (index === 0) {
          return {
            ...tab,
            fields: [...tab.fields, customerNotesField],
          }
        }

        if (index === 1) {
          return {
            ...tab,
            fields: [
              orderShippingNameField,
              ...tab.fields.map((tabField: any) => {
                if (tabField.name !== 'shippingAddress' || !Array.isArray(tabField.fields)) {
                  return tabField
                }

                return {
                  ...tabField,
                  fields: hideEmptyShippingAddressFields(tabField.fields),
                }
              }),
              ...deliveryDetailFields,
            ],
          }
        }

        return tab
      }),
    }
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
      paymentMethods: [manualAdapter(), revolutAdapter()],
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
          ...arrangeOrderAdminTabs(
            applyReadOnlyOrderItemsField(
              addLineItemSnapshotFields(
                clarifyOrderPaymentMethodField(
                  clarifyOrderCustomerField(normalizeMoneyAdminFields(defaultCollection.fields)),
                ),
              ),
            ),
          ),
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
            name: 'shippingFee',
            type: 'number',
            admin: {
              hidden: true,
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Цена на доставка',
          },
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              description:
                'Клиентът може да види поръчката чрез линка, който получава по имейл: https://ibis-electronics.com/orders/{ID}?email={EMAIL}&accessToken={ACCESS_TOKEN}',
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
        fields: appendTransactionCheckoutSnapshotFields(
          addLineItemSnapshotFields(normalizeMoneyAdminFields(defaultCollection.fields)),
        ),
        labels: {
          plural: 'Транзакции',
          singular: 'Транзакция',
        },
      }),
    },
  }),
  seoPlugin({
    collections: ['categories', 'pages', 'partners', 'products'],
    globals: ['contact-page', 'privacy-page', 'terms-page'],
    tabbedUI: true,
    uploadsCollection: 'media',
  }),
  s3Storage({
    alwaysInsertFields: true,
    collections: {
      media: true,
    },
    enabled: hasR2Config,
    bucket: process.env.R2_BUCKET || 'ibis-media-placeholder',
    config: {
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || 'placeholder',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'placeholder',
      },
      endpoint: process.env.R2_ENDPOINT || 'http://localhost',
      region: process.env.R2_REGION || 'auto',
    },
  }),
]
