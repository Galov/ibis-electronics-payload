import { describe, it, expect } from 'vitest'
import {
  reviewedCandidate,
  assertReviewedRecovery,
} from '../../scripts/localization/reviewRecovery'
import { sourceText } from '../../scripts/localization/translationCore'
function job(bg: string, en: string, field = 'description') {
  return {
    errorCode: 'TRANSLATION_VALIDATION_FAILED',
    source: sourceText({
      title: { bg: field === 'title' ? bg : 'Име' },
      description: { bg: field === 'description' ? bg : null },
    }),
    fields: [field],
    rawOutput: JSON.stringify({ [field]: en }),
  }
}
describe('reviewed offline equivalences and immutable lists', () => {
  it('accepts square millimetres and single-pole wording without changing values', () => {
    expect(reviewedCandidate(job('Кабел 2.5 мм2', 'Cable 2.5 mm²', 'title')).accepted).toBe(true)
    expect(reviewedCandidate(job('Кабел 2.5 мм2', 'Cable 3.5 mm²', 'title')).accepted).toBe(false)
    expect(
      reviewedCandidate(job('Контакти: 1-полюсен, 2 извода', 'Contacts: Single-pole, 2 terminals'))
        .accepted,
    ).toBe(true)
    expect(
      reviewedCandidate(job('Контакти: 1-полюсен, 2 извода', 'Contacts: Single-pole, 3 terminals'))
        .accepted,
    ).toBe(false)
  })
  it('accepts explicit power thousands formatting but rejects inferred unit conversions', () => {
    expect(reviewedCandidate(job('Мощност: 1 100 W', 'Power: 1,100 W')).accepted).toBe(true)
    expect(reviewedCandidate(job('Дължина 19,5см', 'Length 195 mm')).accepted).toBe(false)
    expect(reviewedCandidate(job('Втулка Ф3 5 мм', 'Bushing Ø3.5 mm')).accepted).toBe(false)
  })
  it('keeps every original model, duplicate and zero when saved output lost models', () => {
    const list = Array.from(
      { length: 60 },
      (_, i) => `<div>MODEL00${1000 + i} MODEL00${1000 + i}</div>`,
    ).join('\n')
    const j = job('За модели:\n' + list, 'Compatible with models: MODEL001000')
    const c = reviewedCandidate(j)
    expect(c.accepted).toBe(true)
    expect(c.translation.description).toBe('Compatible with models:\n' + list)
    expect(() =>
      assertReviewedRecovery(j, j.source, ['description'], {
        description: 'Compatible with models: MODEL001000',
      }),
    ).toThrow()
  })
  it('holds unknown prose, technical terms, HTML changes and extra fields', () => {
    expect(
      reviewedCandidate(job('Неясен текст ' + 'AB123 '.repeat(250), 'Models AB123')).accepted,
    ).toBe(false)
    expect(reviewedCandidate(job('Ключ за фурна', 'Oven Key', 'title')).accepted).toBe(false)
    expect(
      reviewedCandidate(job('<a href="/one">Код AB123</a>', '<a href="/two">Code AB123</a>'))
        .accepted,
    ).toBe(false)
    const j = job('Име', 'Name', 'title')
    j.rawOutput = '{"title":"Name","description":"Extra"}'
    expect(reviewedCandidate(j).accepted).toBe(false)
  })
  it('does not confuse a changed part number with added separator spaces', () => {
    expect(
      reviewedCandidate(
        job('Оригл код 50298249009,1249691104', 'Original code 50298249009, 1249691104'),
      ).accepted,
    ).toBe(true)
    expect(
      reviewedCandidate(
        job('Оригл код 50298249009,1249691104', 'Original code 50298249009, 1249691105'),
      ).accepted,
    ).toBe(false)
  })
})
