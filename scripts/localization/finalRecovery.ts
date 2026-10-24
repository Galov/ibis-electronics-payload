import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import { reviewedCandidate } from './reviewRecovery'
import {
  validateTranslation,
  normalizeSavedTranslation,
  visibleTranslationText,
  type SourceText,
  type TranslationPath,
} from './translationCore'
const held = new Set([
  '168MI00',
  '600MD74',
  '208AC01',
  '215FR92OR',
  '170AC01',
  '900LG02',
  '161CY10-1',
  '803SU28-1',
  '150SU02',
  '312AR02OR',
  '309CU47',
  '309CU16',
])
// Reviewed translations of source text nodes. Model data and HTML are never regenerated.
const phrases: [string, string][] = [
  ['За модели', 'For models'],
  ['За модел', 'For model'],
  ['Модели', 'Models'],
  ['Оригинален код', 'Original code'],
  ['Ориг.код', 'Original code'],
  ['Преграда за барабан на пералния', 'Drum baffle for washing machines'],
  ['Основа за врътка на програматор', 'Programmer knob base'],
  ['Нагревател за ELECTROLUX ZANUSSI AEG', 'Heater for ELECTROLUX ZANUSSI AEG'],
  ['С NTC и 2 защити', 'With NTC and 2 protective devices'],
  ['За ZANUSSI AEG ELECTROLUX', 'For ZANUSSI AEG ELECTROLUX'],
  ['Преграда за барабан', 'Drum baffle'],
  ['Комплект', 'Set'],
  ['Уплънител за врата на съдомиялни', 'Dishwasher door seal'],
  ['Уплътнител за готварски печки', 'Cooker gasket'],
  ['Ключ механичен за съдомиялни', 'Mechanical dishwasher switch'],
  ['Ключ Амика', 'Amica selector switch'],
  ['Ключ за фурна', 'Oven selector switch'],
  ['позиции', 'positions'],
  ['Обдухващ вентилатор за готварски печки', 'Cooling fan for cookers'],
  ['Диаметър на турбината', 'Impeller diameter'],
  ['Кит за циркулационна помпа', 'Circulation pump kit'],
  ['Горни колелца', 'Upper rollers'],
  ['За 600 оборота', 'For 600 rpm'],
  ['Серия Margherita', 'Margherita series'],
  ['Лагери', 'Bearings'],
  ['Дължина на лъч', 'Arm length'],
  ['Височина', 'Height'],
  ['Размери', 'Dimensions'],
  ['Маншон пералня със сушилня + отвор', 'Washer-dryer door seal with opening'],
  ['За модели 8 и 9 KG', 'For 8 and 9 KG models'],
  ['Силиконов', 'Silicone'],
  ['дебелина на пръстена', 'ring thickness'],
  ['вътрешен', 'inner'],
  ['Маншон за перални машини LG', 'LG washing machine door seal'],
  ['Маншон за перални AMICA, HANSA', 'AMICA, HANSA washing machine door seal'],
  [
    'Служи за уплътняване на барабана и предотвратява теч на вода',
    'Seals the drum and prevents water leakage',
  ],
  ['Флоуметър за кафемашина Bosch,Siemens', 'Flowmeter for Bosch,Siemens coffee machines'],
  ['Панта за готварска печка Gorenje с 2 отвора', 'Gorenje cooker hinge with 2 holes'],
  ['За врати с 2 стъкла', 'For doors with 2 glass panes'],
  ['Цена за 1 брой', 'Price per 1 piece'],
  ['с две дупки за закрепване', 'with two mounting holes'],
  ['Разстояние между отворите', 'Hole spacing'],
  ['Дължина', 'Length'],
  ['Широчина', 'Width'],
  [
    'Плафон за готварски печки ELECTROLUX ZANUSSI AEG',
    'Cooker lamp cover for ELECTROLUX ZANUSSI AEG',
  ],
  ['Външен диаметър', 'Outer diameter'],
  ['Диаметър на резбата', 'Thread diameter'],
  ['Уплътнител\u00a0 корпус съдомиялна', 'Dishwasher housing gasket'],
  ['Vhodné pro:', 'Suitable for:'],
  ['външен', 'outer'],
  ['вътрешен отвор', 'inner bore'],
  ['Флоуметър,водомер за съдомиялни', 'Flowmeter, water meter for dishwashers'],
  ['Температурен сензор за фурна', 'Oven temperature sensor'],
  ['Хепа филтър за прахосмукачка Керхер', 'HEPA filter for Karcher vacuum cleaner'],
  ['Ключ за готварски печки', 'Cooker selector switch'],
  ['стар', 'previous'],
  ['тесен', 'narrow'],
  ['затворен отвор', 'closed aperture'],
]
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
function comparison(s: string): string {
  return s
    .replace(/<(div|span|strong|b|ul|ol|li)\b[^>]*>/gi, (tag) =>
      tag.replace(/\s+(?:data-[\w-]+|aria-owns)\s*=\s*(?:"[^"]*"|'[^']*')/gi, ''),
    )
    .replace(/\b(Machine|Oven|Cooker)\s*-\s*(?=\d{6,})/g, '$1 ')
    .replace(/(?<=\d)-Position/gi, ' position')
    .replace(/оборота в минута|\bRPM\b/gi, 'rpm')
    .replace(/[- ]?1\s+ниво/gi, ' single level')
    .replace('1/2 пране', 'half wash')
    .replace('2-way', 'two-way')
    .replace('Кодове на частта:', 'Part codes:')
    .replace('Cod.orig.', 'Original code ')
    .replace(/(\d{6,}),(?=\d{6,}\b)/g, '$1, ')
    .replace('6 часа/25 минути', '6 hours /25 minutes')
    .replace('6 Hours/25 Minutes', '6 hours /25 minutes')
    .replace('6 hours/25 minutes', '6 hours /25 minutes')
    .replace('На 6 часа - 25 минути дефрост', '6 hours - 25 minutes defrost')
    .replace('Височина113', 'Height 113')
    .replace('Ф8 (8 мм)', 'Ø8 mm')
    .replace('Ф8 (8 mm)', 'Ø8 mm')
    .replace('Ø8 (8 mm)', 'Ø8 mm')
    .replace('НАГРЕВАТЕЛ', 'heater')
    .replace('ЛАМПА', 'lamp')
    .replace('РИЙД АМПУЛА', 'reed switch')
    .replace('Reed switch', 'reed switch')
    .replace('HEPA', 'hepa')
    .replace('Хепа', 'hepa')
    .replace('ХЕПА', 'hepa')
    .replace('HEATER', 'heater')
    .replace('LAMP', 'lamp')
    .replace('Ardo-', 'Ardo ')
    .replace('Single Level', 'single level')
    .replace('Single level', 'single level')
    .replace('Two-way', 'two-way')
    .replace('Двоен клапан (two-way)', 'Double valve (two-way)')
    .replace('6 Hours', '6 hours')
    .replace('25 Minutes', '25 minutes')
    .replace('°С', '°C')
    .replace('\u00a0', ' ')
    .replace('cm/', 'cm /')
    .replace('mm/', 'mm /')
    .replace('  ', ' ')
    .replace(
      /\b(Bosch|Bosh|Siemens|Whirlpool|Gorenje|Electrolux|Indesit|Ariston|Rowenta|SAGE|LG|AEG)\s*-\s*(?=[A-Za-z0-9]*\d)/gi,
      '$1 ',
    )
    .replace(/Хепа/gi, 'hepa')
    .replace(/\bHEPA\b/g, 'hepa')
    .replace(/НАГРЕВАТЕЛ|\bHEATER\b/g, 'heater')
    .replace(/ЛАМПА|\bLAMP\b/g, 'lamp')
    .replace(
      /(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(см|cm)(?![\p{L}\p{N}])/gu,
      (_, n) => `${Number(n.replace(',', '.')) * 10} mm`,
    )
    .replace(/(\d)(?:\s*)(mm|см|cm)\s*\/\s*(?=\d)/g, '$1 $2 / ')
    .replace(/(?<![\p{L}\p{N}])(\d{1,3})[ ,](\d{3})(?=\s*W\b)/gu, '$1$2')
    .replace(/(?<![\p{L}\p{N}])(\d+),(\d+)(?=\s*(?:L|l|л|%)(?![\p{L}\p{N}]))/gu, '$1.$2')
}
export function checkFinalField(source: SourceText, f: TranslationPath, text: string) {
  const bg = comparison(source[f] || ''),
    en = comparison(text)
  validateTranslation({ ...source, [f]: bg }, [f], { [f]: en })
}
function reconstructed(source: string, title: string, enTitle: string) {
  let text = source
  const changes: { from: string; to: string }[] = []
  const replace = (from: string, to: string) => {
    const matches = [...text.matchAll(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))]
    if (!matches.length) return
    if (
      matches.some(
        (m) => m.index! > 1200 || text.lastIndexOf('<', m.index!) > text.lastIndexOf('>', m.index!),
      )
    )
      throw new Error('Unreviewed model-list or attribute text')
    text = text.replaceAll(from, to)
    changes.push({ from, to })
  }
  if (/[А-Яа-я]/u.test(title) && enTitle) replace(title, enTitle)
  // Longest phrases first avoids translating a shorter label within an introduction.
  for (const [from, to] of [...phrases].sort((a, b) => b[0].length - a[0].length)) replace(from, to)
  text = text.replace(/(?<=\d)\s*(мм|см)(?![А-Яа-я])/gu, (_, u) => (u === 'мм' ? ' mm' : ' cm'))
  if (/[А-Яа-яЁёІіЇїҐґЄє]/u.test(visibleTranslationText(text)))
    throw new Error('Source text still requires review')
  if (!/\b(?:models|MODEL|[A-Z]{2,}\d)/i.test(text) || (source.match(/\d{3,}/g) || []).length < 3)
    throw new Error('Not a reviewed model list')
  if (/chladničky|Vhodné pro|sampleF2/i.test(text))
    throw new Error('Imported source requires review')
  return { text, proof: { sourceHash: sha(source), resultHash: sha(text), changes } }
}
function adjusted(job: any, saved: Record<string, string>) {
  const s = { ...saved }
  const sku = job.sku
  for (const f of job.fields) {
    if (sku === '111LG108' && job.source[f] === 'РИЙД АМПУЛА') s[f] = 'Reed switch'
    if (sku === '168BH10' && f === 'description' && job.source.description.includes('Ф37.4 мм'))
      s[f] = s[f].replace(
        'Bushing Diameter (outer for oil seal): 37.4 mm',
        'Bushing Diameter (outer for oil seal): Ø37.4 mm',
      )
    if (sku === '103LG19') s[f] = s[f].replace(/90° elbow/gi, 'L-shaped')
    if (sku === '307ZN24' || sku === '307ZN01')
      s[f] = s[f].replace(/control knob/gi, 'selector switch')
  }
  if (
    sku === '152GR03' &&
    job.source.title === 'GORENJE' &&
    job.source.description?.includes('230/160')
  ) {
    s.title = 'GORENJE'
    s.description = 'Two-level pressure switch - 230/160 170/130 300\nOriginal code - 329449'
  }
  if (
    sku === '116LG274' &&
    job.source.title === 'Product 82694' &&
    job.source.description?.includes('1061 H8 EL')
  ) {
    s.title = job.source.title
    s.description =
      'Washing machine belt 1061 H8 EL\nAriston Merloni Indesit Philco\nOriginal code: 082812'
  }
  if (sku === '140AR00' && job.source.title === 'Product 93988') s.title = job.source.title
  if (sku === '811PE6B')
    s.description = s.description.replace(/^Double coffee/i, 'Filter basket for 2 coffees:')
  if (sku === '154BH08')
    for (const f of job.fields)
      s[f] = s[f].replace(/Type: Two-way valve\./, 'Type: Double valve (2-way).')
  if (sku === '307ZN24') {
    const first = 'Ключ за фурна (селектор за програмите), произвеждан от концерна Electrolux'
    const second =
      'Тъй като е оригинален детайл на шведския производител Electrolux, той се използва в голям брой модели готварски печки и фурни за вграждане под следните брандове на корпорацията: Electrolux, AEG, Zanussi, Zanker'
    const englishFirst = 'Oven switch (program selector), manufactured by Electrolux'
    const englishSecond =
      'As an original part from the Swedish manufacturer Electrolux, it is used in many cooker and built-in oven models under the corporation’s brands: Electrolux, AEG, Zanussi, Zanker'
    if (job.source.description?.startsWith(first + '\n' + second))
      s.description = job.source.description
        .replace(first, englishFirst)
        .replace(second, englishSecond)
    if (job.source['meta.description'] === first) s['meta.description'] = englishFirst
  }
  if (sku === '803BH20')
    for (const f of job.fields) s[f] = s[f].replace('Series 2 vacuum', 'Series 2 (Series 2) vacuum')
  if (sku === '151LG10')
    for (const f of job.fields) s[f] = s[f].replace('Single level 150/100', '1 level 150/100')
  if (sku === '168VE06')
    s.description = s.description
      .replace('Bearing seat diameter 1:', 'Bearing seat diameter:')
      .replace('Bearing seat diameter 2:', 'Bearing seat diameter:')
      .replace('Bushing diameter: 30 mm', 'Bushing diameter: Ø30 mm')
  if (sku === '140VE11')
    s.description = s.description.replace(
      'Part numbers:',
      'Plastic divider (white color) featuring 8 perforation holes.\nPart numbers:',
    )
  if (sku === '116LG644' && job.source.description?.includes('Cod.orig.C00056506'))
    s.description = job.source.description.replace('Cod.orig.', 'Original code ')
  if (sku === '117VE00')
    for (const f of job.fields)
      s[f] = s[f].replace('with the product code 42002568', 'with this product code')
  if (sku === '110TY03')
    for (const f of job.fields)
      s[f] = s[f].replace('Length: 155 mm, Diameter: 8 mm, Thread: 3/4" (P8/275)', 'L155 P8/275')
  if (sku === '316AC05') s.description = s.description.replace('zero-stop', '0-stop')
  if (['806PE200', '806PE197', '806PE144'].includes(sku) && /^\d/.test(job.source.title))
    s.title = job.source.title
  if (sku === '806PE144') s.description = s.description.replace('6x9x14 mm', '6x9x14')
  if (sku === '803PH04')
    s.description = s.description.replace(
      '120mm length, Ø86mm + Ø38mm diameters.',
      '120mm, Ø86+Ø38mm.',
    )
  return s
}
export function finalCandidate(job: any): any {
  try {
    if (held.has(job.sku)) throw new Error('Unclear original data requires separate review')
    const previous = reviewedCandidate(job)
    if (previous.accepted) return previous
    if (
      job.sku === '304CU10' &&
      job.errorCode === 'API_RESPONSE_FAILED' &&
      job.source.title === 'Плафон за фурни Аристон/Индезит C00038035' &&
      [...job.fields].sort().join('|') === 'description|title'
    ) {
      const title = 'Oven lamp cover for Ariston/Indesit C00038035'
      const body = reconstructed(job.source.description || '', job.source.title, title)
      return {
        accepted: true,
        translation: { title, description: body.text },
        restoredCodeFields: ['description'],
        proof: {
          version: 'final-reviewed-v6',
          reviewedTerminology: 'oven lamp cover',
          description: body.proof,
        },
      }
    }
    if (job.errorCode !== 'TRANSLATION_VALIDATION_FAILED')
      throw new Error('Incomplete response remains for review')
    const saved = JSON.parse(job.rawOutput)
    if (Object.keys(saved).sort().join('|') !== [...job.fields].sort().join('|'))
      throw new Error('Unexpected fields')
    const texts = adjusted(job, saved)
    const translation: Record<string, string> = {}
    const proof: Record<string, unknown> = {}
    for (const f of [...job.fields].sort((a, b) =>
      a === 'description' ? 1 : b === 'description' ? -1 : 0,
    ) as TranslationPath[]) {
      let t = texts[f]
      const tags = (value: string) => value.match(/<\/?[a-z][^>]*>/gi) || []
      const sourceTags = tags(job.source[f] || ''),
        targetTags = tags(t)
      const shape = (tag: string) =>
        tag.match(/^<\/?[a-z]+/i)?.[0].toLowerCase() + (tag.endsWith('/>') ? '/' : '')
      if (sourceTags.length && isDeepStrictEqual(sourceTags.map(shape), targetTags.map(shape))) {
        // href/src and event attributes must already match; only presentation metadata may restore.
        const protectedAttrs = (tag: string) =>
          [...tag.matchAll(/\b(?:href|src|on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi)].map(
            (m) => m[0],
          )
        if (isDeepStrictEqual(sourceTags.map(protectedAttrs), targetTags.map(protectedAttrs))) {
          let i = 0
          t = t.replace(/<\/?[a-z][^>]*>/gi, () => sourceTags[i++])
        }
      }
      // Explicit, reviewed terminology and field-placement corrections retain all source values.
      const exact =
        job.sku === '111LG108' &&
        f === 'title' &&
        job.source.title === 'РИЙД АМПУЛА' &&
        t === 'Reed switch'
      const relocated =
        ((job.sku === '152GR03' &&
          job.source.title === 'GORENJE' &&
          job.source.description ===
            'Пресостат две нива -\u00a0230/160\u00a0 170/130\u00a0 300\r\n<div></div>\r\n<div>Ориг.код - 329449</div>') ||
          (job.sku === '116LG274' &&
            job.source.title === 'Product 82694' &&
            job.source.description ===
              'Ремък за пералня 1061 H8 EL\r\n\r\nAriston Merloni Indesit Philco\r\n\r\nОригинален код: 082812')) &&
        [...job.fields].sort().join('|') === 'description|title'
      if (exact || relocated) {
        proof[f] = { reviewedCorrection: true, source: job.source[f], text: t }
      } else
        try {
          t = normalizeSavedTranslation(job.source, [f], { [f]: t }).translation[f]
        } catch {
          try {
            checkFinalField(job.source, f, t)
          } catch (e) {
            if (f !== 'description') throw e
            const firstLine = visibleTranslationText(job.source.description || '')
              .split('\n')[0]
              .trim()
            if (firstLine === visibleTranslationText(job.source.title || '') && translation.title) {
              const restored = translation.title + '\n' + t
              try {
                checkFinalField(job.source, f, restored)
                t = restored
                proof[f] = { restoredTitleLine: true }
                translation[f] = t
                continue
              } catch {
                /* Still requires reconstruction or review. */
              }
            }
            const rebuilt = reconstructed(
              job.source.description || '',
              job.source.title || '',
              translation.title || '',
            )
            t = rebuilt.text
            proof[f] = rebuilt.proof
          }
        }
      translation[f] = t
    }
    if (
      /\bReplica\b|Read Ampoule|Ceiling Lamp|Oven Key/i.test(Object.values(translation).join('\n'))
    )
      throw new Error('Suspicious terminology')
    return {
      accepted: true,
      translation,
      restoredCodeFields: Object.keys(proof).filter((f) => f === 'description'),
      proof: { version: 'final-reviewed-v6', fields: proof },
    }
  } catch (e) {
    return { accepted: false, reason: (e as Error).message }
  }
}
export function assertFinalRecovery(
  job: any,
  source: SourceText,
  fields: TranslationPath[],
  translation: unknown,
) {
  const c = finalCandidate({ ...job, source, fields })
  if (!c.accepted || !isDeepStrictEqual(c.translation, translation))
    throw new Error('Final reviewed recovery proof failed')
}
