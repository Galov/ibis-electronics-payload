// Comparison-only normalization. These helpers never change stored BG text,
// rewrite codes, convert quantities or infer a unit that is absent from source.
const aliases: Record<string, string> = {
  mm: 'mm',
  мм: 'mm',
  cm: 'cm',
  см: 'cm',
  cм: 'cm',
  сm: 'cm',
  ml: 'ml',
  mL: 'ml',
  мл: 'ml',
  l: 'l',
  L: 'l',
  л: 'l',
  m: 'm',
  м: 'm',
  kg: 'kg',
  кг: 'kg',
  W: 'W',
  Вт: 'W',
  kW: 'kW',
  кВт: 'kW',
  V: 'V',
  В: 'V',
  kV: 'kV',
  кВ: 'kV',
  A: 'A',
  А: 'A',
  mA: 'mA',
  N: 'N',
  Н: 'N',
  нютона: 'N',
  ньютон: 'N',
  Newton: 'N',
  Newtons: 'N',
  Hz: 'Hz',
  Гц: 'Hz',
  kHz: 'kHz',
  кГц: 'kHz',
  Ω: 'Ω',
  Ом: 'Ω',
  '°C': '°C',
  '°С': '°C',
  '°F': '°F',
}
// Written-out units are equivalent spellings, never conversions or inferred units.
for (const [names, canonical] of [
  [['литър', 'литра', 'liter', 'liters', 'litre', 'litres'], 'l'],
  [['метър', 'метра', 'meter', 'meters', 'metre', 'metres'], 'm'],
  [['милиметър', 'милиметра', 'millimeter', 'millimeters', 'millimetre', 'millimetres'], 'mm'],
  [['сантиметър', 'сантиметра', 'centimeter', 'centimeters', 'centimetre', 'centimetres'], 'cm'],
] as const) {
  for (const name of names) {
    aliases[name] = canonical
    aliases[name[0].toUpperCase() + name.slice(1)] = canonical
  }
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const unitPattern = Object.keys(aliases)
  .sort((a, b) => b.length - a.length)
  .map(escape)
  .join('|')
const thermalContext = /(?:термостат|терморегулатор|температур|thermostat|temperature)/i
const quantityUnit = new RegExp(
  `(?<![\\p{L}\\p{N}])([-+]?\\d+(?:[.,]\\d+)?)(?:\\s*|\\s*-\\s*)(${unitPattern})(?![\\p{L}\\p{N}])`,
  'gu',
)
const bareCelsius = /(?<![\p{L}\p{N}])([-+]?\d+(?:[.,]\d+)?)\s*[CС](?![\p{L}\p{N}])/gu
const dimensions =
  /(?<![\p{L}\p{N}])(?:[-+]?\d+(?:[.,]\d+)?\s*[xXхХ×]\s*)+[-+]?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?(?![\p{L}\p{N}])/gu

export function canonicalQuantities(value: string, context: string): string {
  let text = value.replace(/(?<![\p{L}\p{N}])[ФфØø∅]\s*(?=\d)/gu, 'Ø ')
  if (thermalContext.test(context))
    text = text.replace(bareCelsius, (_, n: string) => `${n.replace(',', '.')} °C`)
  text = text.replace(
    quantityUnit,
    (_, n: string, u: string) => `${n.replace(',', '.')} ${aliases[u]}`,
  )
  return text.replace(dimensions, (v) =>
    v
      .replace(/\s/g, '')
      .replace(/[XхХ×]/g, 'x')
      .replaceAll(',', '.'),
  )
}

function canonicalModelLists(value: string): string {
  let inModelList = false
  return value
    .split('\n')
    .map((line) => {
      const heading =
        /(?:за\s+модел(?:и|ите)?|модели|compatible(?:\s+with)?\s+models?|models?)\s*:?/i.exec(line)
      const start = heading ? heading.index + heading[0].length : 0
      if (heading) inModelList = true
      const tail = line.slice(start)
      // Known explicit model prefixes cover legacy unlabelled model lines. Never
      // interpret an arbitrary decimal number, diameter or measurement as a list.
      const explicitSeries = /\b(?:MAXWELL\s+ST|POLARIS\s+PMG|KENWOOD\s+MG)\s*\d/i.test(tail)
      const hasUnits =
        /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:mm|cm|ml|l|m|kg|W|V|A|N|Hz|°C|°F)(?![\p{L}\p{N}])/u.test(
          tail,
        )
      const hasDimensions = /\d\s*[xX×хХ]\s*\d/u.test(tail)
      if (
        (inModelList || explicitSeries) &&
        !/[А-Яа-я]/u.test(tail) &&
        !hasUnits &&
        !hasDimensions
      ) {
        return line.slice(0, start) + tail.replace(/(\d{3,}),(?=\d{3,}(?!\d))/g, '$1 ')
      }
      return line
    })
    .join('\n')
}

export function comparisonText(value: string, context: string): string {
  return canonicalModelLists(canonicalQuantities(value, context))
}

export function measurementSignature(value: string): string[] {
  const matches = value.matchAll(
    /(?<![\p{L}\p{N}])([-+]?\d+(?:[.,]\d+)?)\s+(°C|°F|mm|cm|ml|l|m|kg|kW|W|kV|V|mA|A|N|kHz|Hz|Ω)(?![\p{L}\p{N}])/gu,
  )
  return [...matches].map((m) => `${m[1].replace(',', '.')}:${m[2]}`).sort()
}
export function diameterSignature(value: string): string[] {
  return [...value.matchAll(/Ø\s*([-+]?\d+(?:[.,]\d+)?)/g)]
    .map((m) => m[1].replace(',', '.'))
    .sort()
}

// Keep numeric model suffixes attached to their explicit manufacturer/series.
// A matching bag of numbers alone must not allow swapping Maxwell and Polaris.
export function modelSeriesSignature(value: string): string[] {
  const prefixes = [...value.matchAll(/\b(MAXWELL\s+ST|POLARIS\s+PMG|KENWOOD\s+MG)\s*(?=\d)/gi)]
  return prefixes
    .map((match, index) => {
      const start = match.index! + match[0].length
      const end = index + 1 < prefixes.length ? prefixes[index + 1].index! : value.length
      const codes = value.slice(start, end).match(/\d{3,}/g) || []
      return `${match[1].toUpperCase().replace(/\s+/g, ' ')}:${codes.sort().join(',')}`
    })
    .sort()
}
