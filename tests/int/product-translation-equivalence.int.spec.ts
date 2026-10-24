import { describe, expect, it } from 'vitest'
import {
  sourceText,
  normalizeSavedTranslation,
  validateTranslation,
} from '../../scripts/localization/translationCore'
import { comparisonText } from '../../scripts/localization/comparisonText'
const source = (title: string, description: string | null = null) =>
  sourceText({ title: { bg: title }, description: { bg: description } })

describe('conservative list, decimal and unit equivalence', () => {
  it('recognizes decimal commas inside dimensions without changing their values or order', () => {
    const bg = source('22x40x8,5')
    expect(() => normalizeSavedTranslation(bg, ['title'], { title: '22x40x8.5' })).not.toThrow()
    expect(() => normalizeSavedTranslation(bg, ['title'], { title: '22x40x8.6' })).toThrow(
      'Numeric',
    )
    expect(() => normalizeSavedTranslation(bg, ['title'], { title: '40x22x8.5' })).toThrow(
      'Identifier',
    )
  })
  it('recognizes explicit model-list separators and preserves every model occurrence', () => {
    const bg = source(
      'Зъбно колело за Polaris и Maxwell',
      'Зъбно колело за Polaris и Maxwell\nMAXWELL ST 1259,1260, Polaris PMG 1605 ,1805,2005',
    )
    const good =
      'Gear wheel for Polaris and Maxwell\nCompatible with MAXWELL ST 1259, 1260 and Polaris PMG 1605, 1805, 2005 models'
    expect(() => validateTranslation(bg, ['description'], { description: good })).not.toThrow()
    expect(() =>
      validateTranslation(bg, ['description'], { description: good.replace('1805, ', '') }),
    ).toThrow('Numeric')
    expect(() =>
      validateTranslation(bg, ['description'], { description: good.replace('ST 1259', 'ST 1258') }),
    ).toThrow('Numeric')
    expect(() =>
      validateTranslation(bg, ['description'], {
        description: good.replace('ST 1259', 'ST 1605').replace('PMG 1605', 'PMG 1259'),
      }),
    ).toThrow('Identifier association')
    expect(() =>
      validateTranslation(bg, ['description'], {
        description: good.replace('for Polaris and Maxwell', 'for Polaris'),
      }),
    ).toThrow('Identifier')
  })
  it('does not turn an unlabelled comma or unit-bearing decimal into a list', () => {
    expect(comparisonText('1259,1260', '')).toBe('1259,1260')
    expect(comparisonText('Models: 1259,1260 mm', '')).toBe('Models: 1259.1260 mm')
    const bg = source('Код AB1259,1260')
    expect(() => validateTranslation(bg, ['title'], { title: 'Code AB1259 and 1260' })).toThrow(
      'Numeric',
    )
  })
  it('normalizes explicitly given Cyrillic and Latin units, including mixed-letter cm', () => {
    const bg = source('Чаши', 'Вместимост 190 мл. Размер 7,5 cм.')
    expect(() =>
      validateTranslation(bg, ['description'], { description: 'Capacity 190 ml. Size 7.5 cm.' }),
    ).not.toThrow()
    expect(() =>
      validateTranslation(bg, ['description'], { description: 'Capacity 190 l. Size 7.5 cm.' }),
    ).toThrow('Measurement')
  })
  it('recognizes diameter notation and attached mm without losing the diameter marker', () => {
    const bg = source('Втулка', 'Втулка Ф35мм, дължина 10см')
    expect(() =>
      validateTranslation(bg, ['description'], { description: 'Bushing Ø35mm, length 10cm' }),
    ).not.toThrow()
    expect(() =>
      validateTranslation(bg, ['description'], { description: 'Bushing 35mm, length 10cm' }),
    ).toThrow('Measurement')
  })
  it('normalizes Celsius only when explicitly given in a thermal context', () => {
    const bg = source('Термостат 45 С - KST501-79/16')
    expect(() =>
      validateTranslation(bg, ['title'], { title: 'Thermostat 45°C - KST501-79/16' }),
    ).not.toThrow()
    expect(() =>
      validateTranslation(bg, ['title'], { title: 'Thermostat 45°F - KST501-79/16' }),
    ).toThrow('Measurement')
  })
  it('does not add guessed angles, units, convert wattages or move values between fields', () => {
    expect(() =>
      validateTranslation(source('Г-образен маркуч 2.5 m'), ['title'], {
        title: '90° elbow hose 2.5 m',
      }),
    ).toThrow('Numeric')
    expect(() =>
      validateTranslation(source('Планка 6x2.2'), ['title'], { title: 'Bracket 6x2.2 cm' }),
    ).toThrow('Measurement')
    expect(() =>
      validateTranslation(source('Нагревател 1000W'), ['title'], { title: 'Heater 1kW' }),
    ).toThrow('Numeric')
    const bg = source('GORENJE', 'Пресостат 230/160 170/130 300. Код 329449')
    expect(() =>
      validateTranslation(bg, ['title'], { title: 'GORENJE pressure switch 230/160 170/130 300' }),
    ).toThrow('Numeric')
  })
  it('preserves code letters, zeroes and duplicate model entries', () => {
    const bg = source('За модели AB001, AB001, CD456')
    expect(() => validateTranslation(bg, ['title'], { title: 'For models AB001, CD456' })).toThrow(
      'Numeric',
    )
    expect(() =>
      validateTranslation(bg, ['title'], { title: 'For models AB001, AB001, CE456' }),
    ).toThrow('Identifier')
    expect(() =>
      validateTranslation(bg, ['title'], { title: 'For models AB1, AB001, CD456' }),
    ).toThrow('Numeric')
  })
})
