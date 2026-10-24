import { describe, it, expect } from 'vitest'
import {
  finalCandidate,
  checkFinalField,
  assertFinalRecovery,
} from '../../scripts/localization/finalRecovery'
import { sourceText } from '../../scripts/localization/translationCore'
const job = (bg: string, en: string, field = 'description', sku = 'test') => ({
  sku,
  errorCode: 'TRANSLATION_VALIDATION_FAILED',
  source: sourceText({
    title: { bg: field === 'title' ? bg : 'Име' },
    description: { bg: field === 'description' ? bg : null },
  }),
  fields: [field],
  rawOutput: JSON.stringify({ [field]: en }),
})
describe('final offline reviewed recovery', () => {
  it('holds explicitly unclear source data before considering any saved answer', () => {
    for (const sku of [
      '168MI00',
      '600MD74',
      '208AC01',
      '215FR92OR',
      '170AC01',
      '900LG02',
      '161CY10-1',
      '803SU28-1',
    ])
      expect(finalCandidate(job('Име', 'Name', 'title', sku)).accepted).toBe(false)
  })
  it('accepts equivalent centimetres and millimetres but rejects different values', () => {
    expect(() =>
      checkFinalField(
        sourceText({ title: { bg: 'Име' }, description: { bg: 'Разстояние 19,5см' } }),
        'description',
        'Distance 195 mm',
      ),
    ).not.toThrow()
    expect(() =>
      checkFinalField(
        sourceText({ title: { bg: 'Име' }, description: { bg: 'Разстояние 19,5см' } }),
        'description',
        'Distance 196 mm',
      ),
    ).toThrow()
  })
  it('preserves the entire short model list, including duplicates and code punctuation', () => {
    const bg = 'За модели: AB001234, AB001234, CD005678, EF009012'
    const j = job(bg, 'For models: AB001234, CD005678')
    const c = finalCandidate(j)
    expect(c.accepted).toBe(true)
    expect(c.translation.description).toBe(bg.replace('За модели', 'For models'))
    expect(() =>
      assertFinalRecovery(j, j.source, ['description'], { description: 'For models: AB001234' }),
    ).toThrow()
  })
  it('restores source presentation attributes while refusing changed links and events', () => {
    const bg = '<div data-test="one">Код AB001234</div>'
    const c = finalCandidate(job(bg, '<div>Code AB001234</div>'))
    expect(c.accepted).toBe(true)
    expect(c.translation.description).toContain('data-test="one"')
    expect(
      finalCandidate(job('<a href="/one">Код AB001234</a>', '<a href="/two">Code AB001234</a>'))
        .accepted,
    ).toBe(false)
    expect(
      finalCandidate(job('<div>Код AB001234</div>', '<div onclick="bad()">Code AB001234</div>'))
        .accepted,
    ).toBe(false)
  })
  it('corrects the reviewed reed-switch term without affecting arbitrary products', () => {
    expect(
      finalCandidate(job('РИЙД АМПУЛА', 'Read Ampoule', 'title', '111LG108')).translation.title,
    ).toBe('Reed switch')
    expect(finalCandidate(job('Име AB123', 'Ceiling Lamp AB123', 'title')).accepted).toBe(false)
  })
  it('keeps numeric identifiers intact when comparing separated manufacturer labels', () => {
    expect(
      finalCandidate(job('Нагревател Bosch-00123456', 'Bosch Heater 00123456', 'title')).accepted,
    ).toBe(true)
    expect(
      finalCandidate(job('Нагревател Bosch-00123456', 'Bosch Heater 00123457', 'title')).accepted,
    ).toBe(false)
  })
  it('does not infer units, transliterate unknown model codes or accept unreviewed prose', () => {
    expect(finalCandidate(job('Размери 6x2.2', 'Dimensions 6x2.2 cm')).accepted).toBe(false)
    expect(
      finalCandidate(job('Неясен текст За модели: AB123456 AB123456 CD345678', 'Models AB123456'))
        .accepted,
    ).toBe(false)
    expect(
      finalCandidate(
        job(
          'Оригинален код С00092174 За модели AB123456 AB123456 CD345678',
          'Original code C00092174 Models AB123456',
        ),
      ).accepted,
    ).toBe(false)
  })
  it('rebuilds the reviewed oven lamp cover from its complete source model list', () => {
    const title = 'Плафон за фурни Аристон/Индезит C00038035'
    const j = {
      sku: '304CU10',
      errorCode: 'API_RESPONSE_FAILED',
      source: sourceText({
        title: { bg: title },
        description: {
          bg: 'Оригинален код C00038035\n' + title + '\nЗа модели: AB001234 AB001234 CD005678',
        },
      }),
      fields: ['title', 'description'],
    }
    const c = finalCandidate(j)
    expect(c.accepted).toBe(true)
    expect(c.translation.title).toBe('Oven lamp cover for Ariston/Indesit C00038035')
    expect(c.translation.description).toContain('AB001234 AB001234 CD005678')
    expect(
      finalCandidate({ ...j, source: { ...j.source, title: title + ' UNKNOWN' } }).accepted,
    ).toBe(false)
  })
  it('only bypasses ordinary field checks for the exact reviewed relocation source', () => {
    const j = {
      ...job('Име', 'Name', 'title', '152GR03'),
      source: sourceText({
        title: { bg: 'GORENJE' },
        description: {
          bg: 'Пресостат две нива -\u00a0230/160\u00a0 170/130\u00a0 300\r\n<div></div>\r\n<div>Ориг.код - 329449</div>',
        },
      }),
      fields: ['title', 'description'],
      rawOutput: JSON.stringify({
        title: 'GORENJE Pressure Switch 230/160 170/130 300',
        description: 'Original code 329449',
      }),
    }
    const c = finalCandidate(j)
    expect(c.accepted).toBe(true)
    expect(c.translation.title).toBe('GORENJE')
    expect(c.translation.description).toContain('230/160 170/130 300')
    expect(
      finalCandidate({
        ...j,
        source: { ...j.source, description: j.source.description + ' UNKNOWN AB999999' },
      }).accepted,
    ).toBe(false)
  })
})
