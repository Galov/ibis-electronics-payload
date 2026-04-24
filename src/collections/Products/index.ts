import type { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import type { Access } from 'payload'
import { slugField } from 'payload'
import { checkRole } from '@/access/utilities'
import { buildSEOFields } from '@/fields/seo'

const normalizeCatalogCompatibilityFields = ({
  context,
  data,
  originalDoc,
}: {
  context?: Record<string, unknown>
  data?: Record<string, unknown>
  originalDoc?: Record<string, unknown> | null
}) => {
  if (!data) {
    return data
  }

  const price =
    typeof data.price === 'number'
      ? data.price
      : typeof originalDoc?.price === 'number'
        ? originalDoc.price
        : 0

  const sourcePrice =
    typeof data.sourcePrice === 'number' && data.sourcePrice > 0
      ? data.sourcePrice
      : typeof originalDoc?.sourcePrice === 'number' && originalDoc.sourcePrice > 0
        ? originalDoc.sourcePrice
        : context?.preserveMissingSourcePrice
          ? undefined
          : price

  const stockQty =
    typeof data.stockQty === 'number'
      ? data.stockQty
      : typeof originalDoc?.stockQty === 'number'
        ? originalDoc.stockQty
        : 0

  if (typeof sourcePrice === 'number') {
    data.sourcePrice = sourcePrice
  }
  data.priceInUSD = price
  data.priceInEUR = price
  data.priceInUSDEnabled = price > 0
  data.priceInEUREnabled = price > 0
  data.inventory = stockQty

  return data
}

const ensureCatalogCompatibilityFields = ({
  doc,
}: {
  doc?: Record<string, unknown> | null
}) => {
  if (!doc) {
    return doc
  }

  const price = typeof doc.price === 'number' ? doc.price : 0
  const stockQty = typeof doc.stockQty === 'number' ? doc.stockQty : 0

  if (typeof doc.priceInEUR !== 'number') {
    doc.priceInEUR = price
  }

  if (typeof doc.priceInUSD !== 'number') {
    doc.priceInUSD = price
  }

  if (typeof doc.priceInEUREnabled !== 'boolean') {
    doc.priceInEUREnabled = price > 0
  }

  if (typeof doc.priceInUSDEnabled !== 'boolean') {
    doc.priceInUSDEnabled = price > 0
  }

  if (typeof doc.inventory !== 'number') {
    doc.inventory = stockQty
  }

  return doc
}

const syncCatalogFields = ({ data, siblingData, value }: { data?: Record<string, unknown>; siblingData?: Record<string, unknown>; value?: number | null }) => {
  const price = value ?? siblingData?.price ?? data?.price
  return typeof price === 'number' ? price : 0
}

const syncInventoryFields = ({ data, siblingData, value }: { data?: Record<string, unknown>; siblingData?: Record<string, unknown>; value?: number | null }) => {
  const qty = value ?? siblingData?.stockQty ?? data?.stockQty
  return typeof qty === 'number' ? qty : 0
}

const adminOrCatalogPublished: Access = ({ req: { user } }) => {
  if (user && checkRole(['admin'], user)) {
    return true
  }

  return {
    published: {
      equals: true,
    },
  }
}

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  access: {
    ...defaultCollection.access,
    read: adminOrCatalogPublished,
  },
  hooks: {
    ...defaultCollection.hooks,
    afterRead: [...(defaultCollection.hooks?.afterRead || []), ensureCatalogCompatibilityFields],
    beforeChange: [
      ...(defaultCollection.hooks?.beforeChange || []),
      normalizeCatalogCompatibilityFields,
    ],
  },
  admin: {
    ...defaultCollection.admin,
    defaultColumns: ['title', 'sku', 'brand', 'price', 'stockQty', 'published'],
    group: 'Каталог',
    useAsTitle: 'title',
  },
  labels: {
    plural: 'Продукти',
    singular: 'Продукт',
  },
  defaultPopulate: {
    ...defaultCollection.defaultPopulate,
    title: true,
    slug: true,
    sku: true,
    description: true,
    shortDescription: true,
    price: true,
    sourcePrice: true,
    priceInEUR: true,
    priceInEUREnabled: true,
    priceInUSD: true,
    priceInUSDEnabled: true,
    stockQty: true,
    stockStatus: true,
    inventory: true,
    images: true,
    categories: true,
    brand: true,
    published: true,
  },
  fields: [
    { name: 'title', label: 'Име', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Каталог',
          fields: [
            {
              name: 'description',
              label: 'Описание',
              admin: {
                description: 'Основното описание, което се вижда на продуктовата страница.',
              },
              type: 'textarea',
            },
            {
              name: 'shortDescription',
              label: 'Кратко описание',
              admin: {
                description: 'Използвайте го, ако искате по-кратък текст за SEO или кратко резюме.',
              },
              type: 'textarea',
            },
            {
              name: 'images',
              label: 'Снимки',
              type: 'array',
              labels: {
                plural: 'Снимки',
                singular: 'Снимка',
              },
              fields: [
                {
                  name: 'legacyUrl',
                  label: 'Изходен URL',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'storageKey',
                  label: 'Ключ в хранилището',
                  type: 'text',
                  admin: {
                    hidden: true,
                  },
                },
                {
                  name: 'alt',
                  label: 'Alt текст',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          label: 'Детайли',
          fields: [
            {
              name: 'sourceId',
              label: 'Изходен ID',
              type: 'number',
              admin: {
                hidden: true,
              },
              index: true,
              unique: true,
            },
            {
              name: 'sku',
              label: 'Код',
              type: 'text',
              index: true,
            },
            {
              name: 'originalSku',
              label: 'Оригинален код',
              type: 'text',
            },
            {
              name: 'manufacturerCode',
              label: 'Производител / тип',
              type: 'text',
            },
            {
              name: 'brand',
              label: 'Марка',
              type: 'relationship',
              relationTo: 'brands',
            },
            {
              name: 'categories',
              label: 'Категории',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
            },
            {
              name: 'price',
              label: 'Продажна цена (EUR)',
              type: 'number',
              defaultValue: 0,
              required: true,
            },
            {
              name: 'sourcePrice',
              label: 'Изходна цена от Ник (EUR)',
              type: 'number',
              admin: {
                readOnly: true,
                description: 'Базовата цена, получена от Ibis Electronics преди надценката.',
              },
            },
            {
              name: 'priceInEUR',
              label: 'Служебна цена EUR',
              type: 'number',
              admin: {
                hidden: true,
              },
              defaultValue: 0,
              hooks: {
                beforeChange: [syncCatalogFields],
              },
            },
            {
              name: 'priceInEUREnabled',
              label: 'Служебна цена EUR е активна',
              type: 'checkbox',
              admin: {
                hidden: true,
              },
              defaultValue: false,
              hooks: {
                beforeChange: [
                  ({ data, siblingData, value }: { data?: Record<string, unknown>; siblingData?: Record<string, unknown>; value?: boolean | null }) => {
                    const price =
                      siblingData?.priceInEUR ??
                      siblingData?.price ??
                      data?.priceInEUR ??
                      data?.price

                    return typeof price === 'number' ? price > 0 : Boolean(value)
                  },
                ],
              },
            },
            {
              name: 'priceInUSD',
              label: 'Служебна цена',
              type: 'number',
              admin: {
                hidden: true,
              },
              defaultValue: 0,
              hooks: {
                beforeChange: [syncCatalogFields],
              },
            },
            {
              name: 'priceInUSDEnabled',
              label: 'Служебна цена USD е активна',
              type: 'checkbox',
              admin: {
                hidden: true,
              },
              defaultValue: false,
              hooks: {
                beforeChange: [
                  ({ data, siblingData, value }: { data?: Record<string, unknown>; siblingData?: Record<string, unknown>; value?: boolean | null }) => {
                    const price =
                      siblingData?.priceInUSD ??
                      siblingData?.price ??
                      data?.priceInUSD ??
                      data?.price

                    return typeof price === 'number' ? price > 0 : Boolean(value)
                  },
                ],
              },
            },
            {
              name: 'stockQty',
              label: 'Наличност (бр.)',
              type: 'number',
              defaultValue: 0,
            },
            {
              name: 'inventory',
              label: 'Служебна наличност',
              type: 'number',
              admin: {
                hidden: true,
              },
              defaultValue: 0,
              hooks: {
                beforeChange: [syncInventoryFields],
              },
            },
            {
              name: 'stockStatus',
              label: 'Статус наличност',
              type: 'select',
              defaultValue: 'unknown',
              options: [
                {
                  label: 'В наличност',
                  value: 'instock',
                },
                {
                  label: 'Изчерпан',
                  value: 'outofstock',
                },
                {
                  label: 'По заявка',
                  value: 'onbackorder',
                },
                {
                  label: 'Неизвестно',
                  value: 'unknown',
                },
              ],
            },
            {
              name: 'manageStock',
              label: 'Управление на наличност',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                hidden: true,
              },
            },
            {
              name: 'backordersAllowed',
              label: 'Позволени заявки без наличност',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                hidden: true,
              },
            },
            {
              name: 'imagesMigrated',
              label: 'Снимките са мигрирани',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                hidden: true,
              },
            },
            {
              name: 'legacyAttachmentIDs',
              label: 'Служебни attachment ID',
              type: 'json',
              admin: {
                hidden: true,
              },
            },
            {
              name: 'legacyProductUrl',
              label: 'Изходен URL на продукта',
              type: 'text',
              admin: {
                hidden: true,
              },
            },
            {
              name: 'legacyModifiedAt',
              label: 'Последна промяна в изходния сайт',
              type: 'date',
              admin: {
                hidden: true,
              },
            },
            {
              name: 'published',
              label: 'Публикуван',
              type: 'checkbox',
              defaultValue: true,
            },
          ],
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: buildSEOFields(),
        },
      ],
    },
    slugField(),
  ],
})
