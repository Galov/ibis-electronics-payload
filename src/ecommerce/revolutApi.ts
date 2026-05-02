import crypto from 'crypto'

type RevolutCreateOrderInput = {
  amount: number
  currency: string
  customerEmail?: string
  description?: string
  redirectURL?: string
}

export type RevolutOrder = {
  id: string
  token?: string
  public_id: string
  state?: string
  checkout_url?: string
  redirect_url?: string
}

const revolutApiBaseURL =
  process.env.REVOLUT_API_BASE_URL?.replace(/\/$/, '') || 'https://sandbox-merchant.revolut.com/api'
const revolutApiVersion = process.env.REVOLUT_API_VERSION || '2024-05-01'

const getRevolutSecretKey = () => {
  const secretKey = process.env.REVOLUT_SECRET_KEY

  if (!secretKey) {
    throw new Error('Revolut secret key is not configured.')
  }

  return secretKey
}

const buildRevolutHeaders = () => ({
  Authorization: `Bearer ${getRevolutSecretKey()}`,
  'Content-Type': 'application/json',
  'Revolut-Api-Version': revolutApiVersion,
})

const revolutRequest = async <T>(
  path: string,
  init?: {
    body?: Record<string, unknown>
    method?: 'GET' | 'POST'
  },
): Promise<T> => {
  const response = await fetch(`${revolutApiBaseURL}${path}`, {
    method: init?.method || 'GET',
    headers: buildRevolutHeaders(),
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Revolut API error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as T
}

export const toMinorUnits = (amount: number) => Math.round(amount * 100)

export const createRevolutOrder = async ({
  amount,
  currency,
  customerEmail,
  description,
  redirectURL,
}: RevolutCreateOrderInput) => {
  return revolutRequest<RevolutOrder>('/orders', {
    method: 'POST',
    body: {
      amount: toMinorUnits(amount),
      capture_mode: 'automatic',
      ...(customerEmail ? { customer: { email: customerEmail } } : {}),
      currency,
      ...(description ? { description } : {}),
      ...(redirectURL ? { redirect_url: redirectURL } : {}),
    },
  })
}

export const retrieveRevolutOrder = async (orderID: string) => {
  return revolutRequest<RevolutOrder>(`/orders/${orderID}`)
}

export const isRevolutConfigured = () =>
  Boolean(process.env.REVOLUT_SECRET_KEY)

export const isRevolutSuccessState = (state?: null | string) => {
  return state === 'authorised' || state === 'completed'
}

export const mapRevolutEventToTransactionStatus = (event?: null | string) => {
  switch (event) {
    case 'ORDER_AUTHORISED':
    case 'ORDER_COMPLETED':
      return 'succeeded'
    case 'ORDER_CANCELLED':
      return 'cancelled'
    case 'ORDER_FAILED':
      return 'failed'
    default:
      return 'pending'
  }
}

export const verifyRevolutWebhookSignature = ({
  rawBody,
  signatureHeader,
  signingSecret,
  timestamp,
}: {
  rawBody: string
  signatureHeader: string
  signingSecret: string
  timestamp: string
}) => {
  const now = Date.now()
  const timestampNumber = Number(timestamp)

  if (!Number.isFinite(timestampNumber) || Math.abs(now - timestampNumber) > 5 * 60 * 1000) {
    return false
  }

  const payloadToSign = `v1.${timestamp}.${rawBody}`
  const expected = `v1=${crypto.createHmac('sha256', signingSecret).update(payloadToSign).digest('hex')}`
  const expectedBuffer = Buffer.from(expected, 'utf8')

  return signatureHeader.split(',').some((signature) => {
    const candidate = signature.trim()
    const candidateBuffer = Buffer.from(candidate, 'utf8')

    return (
      candidateBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
    )
  })
}
