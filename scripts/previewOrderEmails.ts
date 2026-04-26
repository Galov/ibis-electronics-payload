import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import {
  buildAdminOrderEmailHTML,
  buildCustomerOrderEmailHTML,
} from '../src/ecommerce/orderEmailTemplates'

const previewDir = '/tmp/ibis-email-preview'
const previewArgs = {
  amount: 138.72,
  currency: 'EUR',
  customerEmail: 'client@example.com',
  customerNotes: 'Моля, обадете се преди доставка.',
  deliveryMethod: 'econt-office' as const,
  econtOfficeAddress: 'София, бул. България 77',
  econtOfficeName: 'Офис Econt България',
  items: [
    {
      product: { title: 'Оригинален вентилатор за хладилник Beko' },
      productSKU: '162AR81',
      productUnitPrice: 42.5,
      quantity: 2,
    },
    {
      product: { title: 'Комплект четки 3 броя за iRobot Roomba серия E5 / I7' },
      productSKU: '803IR06',
      productUnitPrice: 9.46,
      quantity: 3,
    },
    {
      product: { title: 'Хепа филтър за прахосмукачка Philips' },
      productSKU: '803PH21',
      productUnitPrice: 25.34,
      quantity: 1,
    },
  ],
  orderAdminURL: 'https://ibis-electronics.com/admin/collections/orders/preview-order',
  orderID: 'preview-order',
  orderURL: 'https://ibis-electronics.com/orders/preview-order?email=client%40example.com&accessToken=preview',
  shippingAddress: {
    firstName: 'Иван',
    lastName: 'Петров',
    phone: '0888123456',
    addressLine1: 'ул. Примерна 12',
    city: 'София',
    country: 'България',
    postalCode: '1000',
    state: 'София-град',
  },
  shippingFee: 15.0,
  speedyOfficeAddress: undefined,
  speedyOfficeName: undefined,
}

mkdirSync(previewDir, { recursive: true })

const customerPath = join(previewDir, 'customer-order-email.html')
const adminPath = join(previewDir, 'admin-order-email.html')

writeFileSync(customerPath, buildCustomerOrderEmailHTML(previewArgs))
writeFileSync(adminPath, buildAdminOrderEmailHTML(previewArgs))

console.log(`Customer email preview: ${customerPath}`)
console.log(`Admin email preview: ${adminPath}`)
