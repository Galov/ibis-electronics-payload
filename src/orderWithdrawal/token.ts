import { createHmac, timingSafeEqual } from 'node:crypto'

type WithdrawalToken = { orderID: string; email: string; expiresAt: number }
const sign = (value: string, secret: string) =>
  createHmac('sha256', secret).update(`order-withdrawal:${value}`).digest('base64url')

export function createWithdrawalToken(
  orderID: string,
  email: string,
  secret: string,
  now = Date.now(),
) {
  if (!secret) throw new Error('MISSING_SECRET')
  const value = Buffer.from(
    JSON.stringify({ orderID, email, expiresAt: now + 86400_000 }),
  ).toString('base64url')
  return `${value}.${sign(value, secret)}`
}

export function verifyWithdrawalToken(
  token: unknown,
  secret: string,
  now = Date.now(),
): WithdrawalToken | null {
  if (typeof token !== 'string' || token.length > 2000 || !secret) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const expected = Buffer.from(sign(parts[0], secret))
    const signature = Buffer.from(parts[1])
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as WithdrawalToken
    if (
      !/^[a-f\d]{24}$/i.test(value.orderID) ||
      typeof value.email !== 'string' ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now
    )
      return null
    return value
  } catch {
    return null
  }
}
