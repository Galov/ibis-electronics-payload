import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { productVersionsRepairHandler } from '@/endpoints/productVersionsAudit'

describe('localized product version repair safety', () => {
  it('blocks writes before looking up any product when localization is enabled', async () => {
    const find = vi.fn()
    const req = {
      user: { roles: ['admin'] },
      method: 'POST',
      url: 'http://localhost/api/repair?apply=true',
      payload: { config: { localization: { locales: ['bg', 'en'] } }, find },
    } as unknown as PayloadRequest
    const response = await productVersionsRepairHandler(req)
    expect(response.status).toBe(409)
    expect(find).not.toHaveBeenCalled()
  })
  it('still requires an administrator', async () => {
    const req = { user: { roles: ['customer'] } } as unknown as PayloadRequest
    expect((await productVersionsRepairHandler(req)).status).toBe(401)
  })
})
