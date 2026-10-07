import { readFile } from 'node:fs/promises'
import { createSign } from 'node:crypto'
import {
  merchantAccountId,
  merchantDataSourceId,
  merchantProductKey,
  type MerchantInput,
} from './productInput'

export class MerchantAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    // Do not expose raw upstream bodies, request headers or credentials in logs/admin.
    super(`Merchant API: HTTP ${status} (${code})`)
  }
}

export const merchantEnabled = () => process.env.MERCHANT_SYNC_ENABLED === 'true'
const root = 'https://merchantapi.googleapis.com'
const dataSource = `accounts/${merchantAccountId}/dataSources/${merchantDataSourceId}`

export class MerchantClient {
  private cachedToken?: { token: string; expires: number }
  private pendingToken?: Promise<string>
  constructor(private readonly transport: typeof fetch = fetch) {}

  private async token(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expires > Date.now() + 60_000)
      return this.cachedToken.token
    if (this.pendingToken) return this.pendingToken
    this.pendingToken = this.authenticate()
    try {
      return await this.pendingToken
    } finally {
      this.pendingToken = undefined
    }
  }

  private async authenticate(): Promise<string> {
    const raw =
      process.env.MERCHANT_SERVICE_ACCOUNT_JSON ||
      (process.env.MERCHANT_SERVICE_ACCOUNT_FILE
        ? await readFile(process.env.MERCHANT_SERVICE_ACCOUNT_FILE, 'utf8')
        : '')
    if (!raw) throw new Error('Липсват server-only Merchant credentials.')
    let key: { client_email: string; private_key: string; project_id: string }
    try {
      key = JSON.parse(raw)
    } catch {
      throw new Error('Невалиден формат на Merchant credentials.')
    }
    if (
      key.client_email !== 'merchant-bg@ibis-merchant-integration.iam.gserviceaccount.com' ||
      key.project_id !== 'ibis-merchant-integration' ||
      !key.private_key
    )
      throw new Error('Merchant credentials не принадлежат на българската интеграция.')
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const now = Math.floor(Date.now() / 1000)
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/content',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`
    const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url')
    const response = await this.transport('https://oauth2.googleapis.com/token', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    })
    if (!response.ok) throw new MerchantAPIError(response.status, 'OAUTH_FAILED')
    const body = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!body.access_token) throw new Error('OAuth не върна access token.')
    this.cachedToken = {
      token: body.access_token,
      expires: Date.now() + (body.expires_in || 3600) * 1000,
    }
    return body.access_token
  }

  async request(
    path: string,
    method = 'GET',
    body?: object,
    allowMissing = false,
  ): Promise<Record<string, unknown> | null> {
    const response = await this.transport(`${root}/${path}`, {
      method,
      signal: AbortSignal.timeout(25_000),
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (allowMissing && response.status === 404) return null
    if (!response.ok) {
      if (response.status === 401) this.cachedToken = undefined
      throw new MerchantAPIError(response.status, 'REQUEST_FAILED')
    }
    return response.status === 204 ? {} : await response.json()
  }

  insert(input: MerchantInput) {
    return this.request(
      `products/v1/accounts/${merchantAccountId}/productInputs:insert?${new URLSearchParams({ dataSource })}`,
      'POST',
      input,
    )
  }
  remove(productId: string) {
    const key = Buffer.from(merchantProductKey(productId)).toString('base64url')
    return this.request(
      `products/v1/accounts/${merchantAccountId}/productInputs/${key}?${new URLSearchParams({ dataSource })}`,
      'DELETE',
      undefined,
      true,
    )
  }
  status(productId: string) {
    const key = Buffer.from(merchantProductKey(productId)).toString('base64url')
    return this.request(
      `products/v1/accounts/${merchantAccountId}/products/${key}`,
      'GET',
      undefined,
      true,
    )
  }
  source() {
    return this.request(`datasources/v1/${dataSource}`)
  }
}
export const merchantClient = new MerchantClient()
