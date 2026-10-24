import { describe, expect, it } from 'vitest'
import {
  isEmptyProductText,
  sourceText,
  missingEnglishFields,
  validateTranslation,
  normalizeSavedTranslation,
  englishPatch,
  visibleTranslationText,
} from '../../scripts/localization/translationCore'
import { recoveryCandidate } from '../../scripts/localization/recoverTranslations.mjs'
const source = (title = 'Име', description: string | null = null) =>
  sourceText({ title: { bg: title }, description: { bg: description } })

describe('offline safe translation recovery', () => {
  it('accepts cosmetic HTML wrappers but preserves visible numbers', () => {
    const bg = source('Име', '<div><span style="font-size: 11px">Код C00303589, 120N</span></div>')
    expect(() =>
      validateTranslation(bg, ['description'], { description: '<p>Code C00303589, 120N</p>' }),
    ).not.toThrow()
    expect(() =>
      validateTranslation(bg, ['description'], { description: '<p>Code C00303588, 120N</p>' }),
    ).toThrow('Numeric')
  })
  it('does not mistake numeric HTML entities for product numbers', () => {
    const bg = source('Име', 'Код C00303589 &#8211; 120N')
    expect(() =>
      validateTranslation(bg, ['description'], { description: 'Code C00303589 – 120N' }),
    ).not.toThrow()
    expect(visibleTranslationText('&#xA0;&nbsp;')).toBe('')
  })
  it('skips encoded empty descriptions instead of requesting or saving fake translations', () => {
    const bg = source('Лампа', '&nbsp;\r\n&nbsp;')
    expect(isEmptyProductText(bg.description)).toBe(true)
    expect(
      missingEnglishFields({ title: { bg: 'Лампа' }, description: { bg: bg.description } }, bg),
    ).toEqual(['title'])
    expect(() =>
      validateTranslation(bg, ['title', 'description'], { title: 'Lamp', description: '\u00a0' }),
    ).not.toThrow()
    expect(englishPatch({ title: 'Lamp', description: '\u00a0' }, bg)).toEqual({
      'title.en': 'Lamp',
    })
    expect(() =>
      validateTranslation(bg, ['description'], { description: 'Invented specification' }),
    ).toThrow('Invented')
  })
  it('restores code-only source formatting without guessing dimensional punctuation', () => {
    const bg = source('25X50,75X10/12')
    const recovered = normalizeSavedTranslation(bg, ['title'], { title: '25X50, 75X10/12' })
    expect(recovered.translation.title).toBe('25X50,75X10/12')
    expect(recovered.restoredCodeFields).toEqual(['title'])
    expect(() => normalizeSavedTranslation(bg, ['title'], { title: '25X50.75X10/12' })).toThrow(
      'Identifier',
    )
  })
  it('preserves exact source casing for unchanged brand and model-only fields', () => {
    const bg = source('INDESIT ARISTON AB123')
    const result = normalizeSavedTranslation(bg, ['title'], { title: 'Indesit Ariston ab123' })
    expect(result.translation.title).toBe('INDESIT ARISTON AB123')
    expect(result.restoredCodeFields).toEqual(['title'])
  })
  it('does not repair a changed part number by guessing', () => {
    expect(() =>
      normalizeSavedTranslation(source('Код 59999'), ['title'], { title: 'Code 5999' }),
    ).toThrow('Numeric')
  })
  it('retains all model identifiers and rejects changed letters even if digits match', () => {
    const bg = source('Помпа AB123', 'Модели AB123, CD456')
    expect(() => validateTranslation(bg, ['title'], { title: 'Pump AC123' })).toThrow('Identifier')
    expect(() => validateTranslation(bg, ['description'], { description: 'Models AB123' })).toThrow(
      'Numeric',
    )
    expect(() =>
      validateTranslation(bg, ['description'], { description: 'Models AB123, CE456' }),
    ).toThrow('Identifier')
  })
  it('does not relax unit, link, table or superscript changes', () => {
    expect(() =>
      validateTranslation(source('Размер 10 mm'), ['title'], { title: 'Size 10 cm' }),
    ).toThrow()
    expect(() =>
      validateTranslation(source('Име', '<a href="/one">Код 123</a>'), ['description'], {
        description: '<a href="/two">Code 123</a>',
      }),
    ).toThrow('HTML')
    expect(() =>
      validateTranslation(source('Име', '<table><tr><td>123</td></tr></table>'), ['description'], {
        description: '123',
      }),
    ).toThrow('HTML')
    expect(() =>
      validateTranslation(source('Име', 'm<sup>2</sup>'), ['description'], { description: 'm2' }),
    ).toThrow('HTML')
  })
  it('keeps known suspicious technical translations for human review', () => {
    expect(() =>
      normalizeSavedTranslation(source('РИЙД АМПУЛА', '&nbsp;'), ['title', 'description'], {
        title: 'Read Ampoule',
        description: '\u00a0',
      }),
    ).toThrow('Terminology')
    expect(() =>
      normalizeSavedTranslation(source('Ключ за фурна'), ['title'], { title: 'Oven Key' }),
    ).toThrow('Terminology')
  })
  it('never accepts incomplete API responses or resumes paid work', () => {
    expect(recoveryCandidate({ errorCode: 'API_RESPONSE_FAILED' })).toEqual({
      accepted: false,
      reason: 'INCOMPLETE_OR_API_RESPONSE_REQUIRES_REVIEW',
    })
    expect(
      recoveryCandidate({
        errorCode: 'TRANSLATION_VALIDATION_FAILED',
        source: source(),
        fields: ['title'],
        rawOutput: '{"title":',
      }).accepted,
    ).toBe(false)
  })
})
