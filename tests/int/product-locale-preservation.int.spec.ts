// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { preserveProductLocaleInput, preserveOtherProductLocale } from '@/i18n/preserveProductLocales'

describe('preserving locales across stale drafts', () => {
  it('preserves direct EN text absent from a prior version, and refreshes each operation with req', async () => {
    const document={id:'id',title:{bg:'Помпа 30W',en:'Pump 30W'},description:{bg:'Описание',en:'Description'}}
    const findOne=vi.fn(async(_args: any)=>document)
    const req:any={locale:'bg',payload:{db:{findOne}}}
    const data:any={title:'Помпа 40W'}
    await preserveProductLocaleInput({operation:'update',originalDoc:{id:'id'},data,req} as any)
    expect(data.description).toBe('Описание')
    const prior:any={title:{bg:'Помпа 30W'}}
    const value=await preserveOtherProductLocale({operation:'update',originalDoc:{id:'id'},field:{name:'title'},path:['title'],value:data.title,siblingDocWithLocales:prior,req} as any)
    expect(value).toBe('Помпа 40W')
    expect(prior.title.en).toBe('Pump 30W')
    expect(findOne).toHaveBeenCalledTimes(1)
    expect(findOne.mock.calls[0][0].req).toBe(req)
    req.locale='en'
    const next:any={}
    await preserveProductLocaleInput({operation:'update',originalDoc:{id:'id'},data:next,req} as any)
    expect(next.title).toBe('Pump 30W')
    expect(findOne).toHaveBeenCalledTimes(2)
  })
})
