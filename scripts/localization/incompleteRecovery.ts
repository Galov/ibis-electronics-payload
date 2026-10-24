import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import {
  normalizeSavedTranslation,
  type SourceText,
  type TranslationPath,
  sourceFingerprint,
} from './translationCore'

// These short text translations were reviewed against the cached responses.
// They are not applied to arbitrary products or to model/code strings.
const reviewedSKUs = new Set([
  '113CY06A',
  '163BH22',
  '152ID01',
  '167AR01',
  '140CY37OR',
  '146ZN01',
  '148AR08',
  '320GR16',
  '166IG06',
  '301AR04',
  '162BH23',
  '161CY10',
  '308CU16',
  '140GR19',
  '140ZN60OR',
  '117AC03',
  '167AR03OR',
  '126IG05',
  '148IG40',
  '161ZN10OR',
])
const heldSKUs: Record<string, string> = {
  '161CY10-1': 'COPY_TRANSLATED_AS_REPLICA',
  '304CU10': 'OVEN_LAMP_COVER_TRANSLATED_AS_CEILING_LAMP',
}
const titleFallbacks: Record<string, [string, string]> = {
  '166IG06': ['Ролка за сушилни', 'Dryer Roller for'],
  '140ZN60OR': ['Пръскалка за съдомиялни', 'Dishwasher Spray Arm for'],
  '162BH23': ['Циркулационна помпа за съдомиялна БОШ', 'Circulation Pump for Bosch Dishwasher'],
}
const introRules: Record<string, [string, string]> = {
  '167AR01': [
    'Амортисьори за перални Аристон и Индезит',
    'Shock Absorbers for Ariston and Indesit washing machines',
  ],
  '126IG05': [
    'Долен уплътнител за врата на съдомиялни машини\u00a0 WHIRLPOOL',
    'Lower door gasket for WHIRLPOOL dishwashers',
  ],
}
const labels: [string, string][] = [
  ['За Модели', 'Compatible with models'],
  ['За модели', 'Compatible with models'],
  ['Модели', 'Models'],
  ['Оригинален код', 'Original code'],
  ['Ориг.код', 'Original code'],
  ['Заменя се от', 'Replaced by'],
  ['Дължина', 'Length'],
]
const digest = (text: string) => createHash('sha256').update(text).digest('hex')

type Quoted = { value: string; end: number; complete: boolean }
function quoted(text: string, start: number): Quoted {
  if (text[start] !== '"') throw new Error('Expected quoted JSON string')
  let i = start + 1,
    raw = ''
  for (; i < text.length; ) {
    const c = text[i]
    if (c === '"') return { value: JSON.parse(`"${raw}"`), end: i + 1, complete: true }
    if (c === '\\') {
      const next = text[i + 1]
      if (next === undefined) break
      const size = next === 'u' ? 6 : 2
      if (i + size > text.length) break
      if (next === 'u' && !/^\\u[0-9a-f]{4}$/i.test(text.slice(i, i + size)))
        throw new Error('Invalid JSON unicode escape')
      raw += text.slice(i, i + size)
      i += size
    } else {
      if (c.charCodeAt(0) < 32) throw new Error('Unescaped JSON control character')
      raw += c
      i++
    }
  }
  return { value: JSON.parse(`"${raw}"`), end: i, complete: false }
}

// Only a JSON-string prefix is decoded. This never guesses a missing suffix,
// closes an incomplete model code, or treats an incomplete title as complete.
export function parseIncompleteObject(text: string): Record<string, Quoted> {
  const fields: Record<string, Quoted> = Object.create(null)
  let i = 0
  const ws = () => {
    while (/\s/.test(text[i] || '') && i < text.length) i++
  }
  ws()
  if (text[i++] !== '{') throw new Error('Expected a JSON object')
  while (i < text.length) {
    ws()
    if (text[i] === '}') break
    const key = quoted(text, i)
    if (!key.complete) break
    if (!['title', 'description'].includes(key.value) || Object.hasOwn(fields, key.value))
      throw new Error('Unexpected or duplicate cached field')
    i = key.end
    ws()
    if (text[i++] !== ':') throw new Error('Invalid JSON property')
    ws()
    const value = quoted(text, i)
    fields[key.value] = value
    i = value.end
    if (!value.complete) break
    ws()
    if (text[i] === '}') {
      i++
      break
    }
    if (text[i] === ',') {
      i++
      continue
    }
    if (i === text.length) break
    throw new Error('Invalid JSON separator')
  }
  return fields
}

type Patch = { start: number; end: number; from: string; to: string; kind: string }
function outsideTag(source: string, start: number, end: number) {
  return (
    !(source.match(/<[^>]*>/g) || []).length ||
    ![...source.matchAll(/<[^>]*>/g)].some((m) => start < m.index! + m[0].length && end > m.index!)
  )
}
function rebuildDescription(
  source: string,
  sourceTitle: string,
  englishTitle: string,
  partialDescription: string,
  sku: string,
) {
  const patches: Patch[] = []
  const add = (from: string, to: string, kind: string) => {
    const start = source.indexOf(from)
    if (start < 0) return
    if (source.indexOf(from, start + from.length) >= 0)
      throw new Error('Ambiguous repeated header text')
    if (start + from.length > 1024 || !outsideTag(source, start, start + from.length))
      throw new Error('Header patch overlaps a tag or model list')
    if (patches.some((p) => start < p.end && start + from.length > p.start)) return
    patches.push({ start, end: start + from.length, from, to, kind })
  }
  if (/[А-Яа-я]/u.test(sourceTitle) && source.includes(sourceTitle))
    add(sourceTitle, englishTitle, 'verified-product-title')
  const intro = introRules[sku]
  if (intro) {
    if (!partialDescription.toLowerCase().includes(intro[1].toLowerCase()))
      throw new Error('Reviewed intro not present in cached response')
    add(...intro, 'cached-complete-intro')
  }
  for (const [from, defaultText] of labels) {
    const to =
      from === 'За модели' && ['152ID01', '148AR08'].includes(sku)
        ? 'Compatible models'
        : defaultText
    if (source.includes(from) && !partialDescription.toLowerCase().includes(to.toLowerCase()))
      throw new Error('Reviewed label not present in cached response')
    add(from, to, 'cached-label')
  }
  patches.sort((a, b) => a.start - b.start)
  let result = '',
    position = 0
  const unchanged: string[] = []
  for (const patch of patches) {
    const chunk = source.slice(position, patch.start)
    unchanged.push(chunk)
    result += chunk + patch.to
    position = patch.end
  }
  const tail = source.slice(position)
  unchanged.push(tail)
  result += tail
  if (/[А-Яа-яЁёІіЇїҐґЄє]/u.test(result)) throw new Error('Untranslated source text remains')
  // Every byte outside the reviewed header replacements is copied verbatim,
  // including duplicates, leading zeroes, model associations and original HTML.
  return {
    description: result,
    proof: {
      sourceDescriptionHash: digest(source),
      unchangedChunksHash: digest(JSON.stringify(unchanged)),
      immutableSuffixHash: digest(tail),
      immutableSuffixChars: tail.length,
      patches,
    },
  }
}

type Job = {
  sku?: string
  customId: string
  source: SourceText
  fields: TranslationPath[]
  fingerprint?: string
}
export function incompleteCandidate(job: Job, row: any): any {
  try {
    const sku = job.sku || ''
    if (heldSKUs[sku]) return { accepted: false, reason: heldSKUs[sku] }
    if (!reviewedSKUs.has(sku))
      throw new Error('Product requires an explicit incomplete-response review')
    if ([...job.fields].sort().join('|') !== 'description|title')
      throw new Error('Other untranslated fields remain')
    if (row?.custom_id !== job.customId || row?.response?.status_code !== 200)
      throw new Error('Cached response identity mismatch')
    const body = row.response.body
    if (body.status !== 'incomplete' || body.incomplete_details?.reason !== 'max_output_tokens')
      throw new Error('Not a known output-length interruption')
    const text = (body.output || [])
      .flatMap((item: any) => item.content || [])
      .filter((item: any) => item.type === 'output_text')
      .map((item: any) => item.text)
      .join('')
    const prefix = parseIncompleteObject(text)
    if (!prefix.title?.complete || !prefix.description || prefix.description.complete)
      throw new Error('Missing complete title or incomplete description prefix')
    let title = prefix.title.value
    try {
      title = normalizeSavedTranslation(job.source, ['title'], { title }).translation.title
    } catch (error) {
      const fallback = titleFallbacks[sku]
      if (
        !fallback ||
        !job.source.title?.includes(fallback[0]) ||
        !prefix.title.value.toLowerCase().includes(fallback[1].toLowerCase())
      )
        throw error
      title = job.source.title.replace(fallback[0], fallback[1])
      normalizeSavedTranslation(job.source, ['title'], { title })
    }
    const source = job.source.description
    if (!source || source.length < 1000) throw new Error('Not a long model-list description')
    if ((source.match(/\b[A-Za-z0-9][A-Za-z0-9._/()+-]*\d[A-Za-z0-9._/()+-]*/g) || []).length < 50)
      throw new Error('Insufficient model-list evidence')
    const rebuilt = rebuildDescription(
      source,
      job.source.title || '',
      title,
      prefix.description.value,
      sku,
    )
    return {
      accepted: true,
      translation: { title, description: rebuilt.description },
      restoredCodeFields: ['description'],
      proof: {
        version: 'immutable-model-lists-v4',
        sourceFingerprint: sourceFingerprint(job.source),
        cachedTextHash: digest(text),
        responseId: body.id,
        ...rebuilt.proof,
      },
      receipt: { responseId: body.id, model: body.model, usage: body.usage },
    }
  } catch (error) {
    return { accepted: false, reason: (error as Error).message }
  }
}
export function assertIncompleteReconstruction(
  job: Job,
  row: any,
  source: SourceText,
  fields: TranslationPath[],
  translation: unknown,
): void {
  const candidate = incompleteCandidate({ ...job, source, fields }, row)
  if (!candidate.accepted || !isDeepStrictEqual(candidate.translation, translation))
    throw new Error('Incomplete-response reconstruction proof failed')
}
