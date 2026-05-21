type BoxNowAuthResponse = {
  access_token?: string
  expires_in?: number
}

type BoxNowDestination = {
  addressLine1?: string
  addressLine2?: string
  id?: string
  lat?: string
  lng?: string
  name?: string
  note?: string
  postalCode?: string
  title?: string
  type?: string
}

type BoxNowLockersResponse = {
  data?: BoxNowDestination[]
}

type BoxNowCreateDeliveryRequestResponse = {
  id?: string
  parcels?: Array<{
    id?: string
  }>
}

type BoxNowErrorResponse = {
  code?: string
  message?: string
  parcelIds?: string[]
  status?: number
}

type CachedToken = {
  accessToken: string
  expiresAt: number
}

type BoxNowLocker = {
  address: string
  id: string
  latitude: string
  longitude: string
  name: string
  postalCode: string
}

type BoxNowShipmentItemInput = {
  compartmentSize: 1 | 2 | 3
  id: string
  name: string
  value: string
  weight: number
}

type BoxNowCreateDeliveryRequestInput = {
  amountToBeCollected: string
  contactEmail: string
  contactName: string
  contactNumber: string
  destinationLocationId: string
  invoiceValue: string
  items: BoxNowShipmentItemInput[]
  orderNumber: string
  originLocationId: string
  paymentMode: 'cod' | 'prepaid'
}

export type BoxNowShipmentResult = {
  deliveryRequestId: string
  parcelIds: string[]
}

const BOXNOW_API_BASE_URL = process.env.BOXNOW_API_BASE_URL || 'https://api-production.boxnow.bg/api/v1'

let cachedToken: CachedToken | null = null
let cachedLockers: BoxNowLocker[] | null = null

const getBoxNowCredentials = () => {
  const clientID = process.env.BOXNOW_CLIENT_ID || ''
  const clientSecret = process.env.BOXNOW_CLIENT_SECRET || ''

  if (!clientID || !clientSecret) {
    throw new Error('Липсват BOXNOW_CLIENT_ID и/или BOXNOW_CLIENT_SECRET за BoxNow.')
  }

  return { clientID, clientSecret }
}

const readErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as BoxNowErrorResponse

    if (data.code && data.message) {
      return `${data.code}: ${data.message}`
    }

    if (data.code) {
      return data.code
    }

    if (data.message) {
      return data.message
    }
  } catch {
    return undefined
  }

  return undefined
}

export const getBoxNowAccessToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const { clientID, clientSecret } = getBoxNowCredentials()
  const response = await fetch(`${BOXNOW_API_BASE_URL}/auth-sessions`, {
    body: JSON.stringify({
      client_id: clientID,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    method: 'POST',
  })

  const data = (await response.json()) as BoxNowAuthResponse

  if (!response.ok || !data.access_token) {
    throw new Error('Неуспешна автентикация към BoxNow.')
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (typeof data.expires_in === 'number' ? data.expires_in : 3600) * 1000,
  }

  return cachedToken.accessToken
}

export const loadBoxNowLockers = async () => {
  if (cachedLockers) return cachedLockers

  const accessToken = await getBoxNowAccessToken()
  const response = await fetch(`${BOXNOW_API_BASE_URL}/destinations?locationType=apm`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const data = (await response.json()) as BoxNowLockersResponse

  if (!response.ok) {
    throw new Error('Възникна проблем при зареждането на автоматите на BoxNow.')
  }

  cachedLockers = (Array.isArray(data.data) ? data.data : [])
    .filter((locker) => locker.id && (locker.name || locker.title))
    .map((locker) => ({
      address: [locker.addressLine1, locker.addressLine2, locker.note].filter(Boolean).join(', '),
      id: locker.id || '',
      latitude: locker.lat || '',
      longitude: locker.lng || '',
      name: locker.name || locker.title || '',
      postalCode: locker.postalCode || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  return cachedLockers
}

export const createBoxNowDeliveryRequest = async (
  input: BoxNowCreateDeliveryRequestInput,
): Promise<BoxNowShipmentResult> => {
  const accessToken = await getBoxNowAccessToken()
  const response = await fetch(`${BOXNOW_API_BASE_URL}/delivery-requests`, {
    body: JSON.stringify({
      allowReturn: false,
      amountToBeCollected: input.amountToBeCollected,
      destination: {
        contactEmail: input.contactEmail,
        contactName: input.contactName,
        contactNumber: input.contactNumber,
        locationId: input.destinationLocationId,
      },
      invoiceValue: input.invoiceValue,
      items: input.items,
      orderNumber: input.orderNumber,
      origin: {
        locationId: input.originLocationId,
      },
      paymentMode: input.paymentMode,
      showRecipientInformation: true,
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response)
    throw new Error(errorMessage || 'BoxNow отказа създаването на пратката.')
  }

  const data = (await response.json()) as BoxNowCreateDeliveryRequestResponse
  const deliveryRequestId = data.id?.trim()
  const parcelIds = (Array.isArray(data.parcels) ? data.parcels : [])
    .map((parcel) => parcel.id?.trim())
    .filter((value): value is string => Boolean(value))

  if (!deliveryRequestId || parcelIds.length === 0) {
    throw new Error('BoxNow върна непълен отговор при създаването на пратката.')
  }

  return {
    deliveryRequestId,
    parcelIds,
  }
}

export const downloadBoxNowParcelLabel = async (parcelId: string) => {
  const accessToken = await getBoxNowAccessToken()
  const response = await fetch(`${BOXNOW_API_BASE_URL}/parcels/${encodeURIComponent(parcelId)}/label.pdf`, {
    headers: {
      Accept: 'application/pdf',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response)
    throw new Error(errorMessage || 'Неуспешно изтегляне на BoxNow етикет.')
  }

  return response.arrayBuffer()
}
