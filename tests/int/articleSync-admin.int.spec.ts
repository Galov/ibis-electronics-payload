import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ArticleSyncActions } from '@/components/admin/ArticleSyncActions'

const state = vi.hoisted(() => ({ id: '000000000000000000000001', modified: false }))
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ({ id: state.id }),
  useFormModified: () => state.modified,
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  state.modified = false
})
describe('Bulgarian article admin control', () => {
  it('does not send automatically and blocks unsaved changes', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    state.modified = true
    render(createElement(ArticleSyncActions))
    const button = screen.getByRole('button', {
      name: 'Изпрати за превод към РО / повтори',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('shows actual queued status in Bulgarian and allows explicit status checks', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ status: 'queued' }))
      .mockResolvedValueOnce(
        Response.json({ status: 'succeeded', warnings: ['Проверете връзката'] }),
      )
    vi.stubGlobal('fetch', fetcher)
    render(createElement(ArticleSyncActions))
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати за превод към РО / повтори' }))
    await waitFor(() => expect(screen.getByText('Чака превод')).toBeTruthy())
    expect(fetcher.mock.calls[0]).toEqual([
      `/api/article-sync/posts/${state.id}/send`,
      { method: 'POST', credentials: 'same-origin' },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Провери статуса' }))
    await waitFor(() => expect(screen.getByText('РО черновата е готова за преглед')).toBeTruthy())
    expect(screen.getByText('Проверете връзката')).toBeTruthy()
  })
})
