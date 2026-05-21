export type DeliveryMethod = 'address' | 'boxnow' | 'econt-office' | 'speedy-office'

export const BOXNOW_FREE_SHIPPING_UNTIL_LABEL = '31 юли 2026 г.'

const genericDeliveryPricingNote =
  'Цената не включва доставката. Тя се определя по тарифата на избраната куриерска компания и се заплаща при получаване на пратката.'

export const getDeliveryMethodLabel = (deliveryMethod?: DeliveryMethod | null) => {
  switch (deliveryMethod) {
    case 'boxnow':
      return 'Автомат на BoxNow'
    case 'econt-office':
      return 'Офис на Econt'
    case 'speedy-office':
      return 'Офис на Speedy'
    default:
      return 'До адрес'
  }
}

export const getDeliveryPricingNote = (deliveryMethod?: DeliveryMethod | null) => {
  if (deliveryMethod === 'boxnow') {
    return `Промоционално: безплатна доставка с BoxNow до ${BOXNOW_FREE_SHIPPING_UNTIL_LABEL}. При получаване плащането е възможно само с карта, ако поръчката не е платена онлайн.`
  }

  return genericDeliveryPricingNote
}
