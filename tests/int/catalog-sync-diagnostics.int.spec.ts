import { describe, expect, it } from 'vitest'
import { catalogSyncErrorDetails } from '../../src/services/catalogSync/diagnostics'

describe('catalog sync CLI diagnostics', () => {
  it('retains error types and nested causes without stacks or data', () => {
    const error = new Error('Unable to load product', { cause: new TypeError('Invalid relation') })
    Object.assign(error, { data: { password: 'private' } })
    expect(catalogSyncErrorDetails(error)).toEqual([
      { name: 'Error', message: 'Unable to load product' },
      { name: 'TypeError', message: 'Invalid relation' },
    ])
  })
  it('redacts credentials, URLs and quoted values', () => {
    const result = JSON.stringify(
      catalogSyncErrorDetails(
        new Error(
          'Failed https://user:pass@example.com/path Bearer abc password=xyz value "private body"',
        ),
      ),
    )
    for (const secret of ['user:pass', 'example.com', 'abc', 'xyz', 'private body']) {
      expect(result).not.toContain(secret)
    }
  })
  it('bounds messages and handles cyclic causes and non-errors', () => {
    const error = new Error('x'.repeat(2000))
    error.cause = error
    expect(catalogSyncErrorDetails(error)).toHaveLength(1)
    expect(catalogSyncErrorDetails(error)[0].message.length).toBe(600)
    expect(catalogSyncErrorDetails({ payload: 'private' })).toEqual([])
  })
})
