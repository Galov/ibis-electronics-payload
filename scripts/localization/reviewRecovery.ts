import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import {
  normalizeSavedTranslation,
  validateTranslation,
  visibleTranslationText,
  type SourceText,
  type TranslationPath,
} from './translationCore'

const labels: [string, string[]][] = [
  ['За модели', ['Compatible with models', 'Compatible models', 'For models']],
  ['Модели', ['Compatible models', 'Models']],
  ['Оригинален код', ['Original part code', 'Original code']],
  ['Ориг.код', ['Original code']],
  ['Оригл код', ['Original code']],
  ['Височина', ['Height']],
  ['За перални BOSCH SIEMENS BALAY', ['For BOSCH SIEMENS BALAY washing machines']],
  ['Сензор двигател директ драйв', ['Direct drive motor sensor']],
  ['Турбина сушилня GORENJE', ['Dryer turbine for GORENJE']],
  ['Амортисьор', ['Shock Absorber']],
  ['Циркулационна помпа', ['Circulation pump']],
]
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
// Comparison only: every equivalence is explicit in both original and saved text.
function equivalent(value: string, other: string): string {
  let s = value
  if (/(?:мм2|mm²)/u.test(value + other)) s = s.replace(/мм2|mm²/gu, 'mmSQ')
  if (/1-полюсен/u.test(value + other) && /single-pole/i.test(value + other))
    s = s.replace(/1-полюсен|single-pole/gi, 'singlepole')
  if (/1-фазен/u.test(value + other) && /single-phase/i.test(value + other))
    s = s.replace(/1-фазен|single-phase/gi, 'singlephase')
  if (/(?:Мощност|Power|Консумация|consumption)/i.test(value + other)) {
    s = s.replace(/(?<![\p{L}\p{N}])(\d{1,3})[ ,](\d{3})(?=\s*W\b)/gu, '$1$2')
  }
  // Explicit code lists, never decimals or arbitrary comma-separated quantities.
  if (/(?:Оригл код|Оригинален код|Original code)/i.test(value + other))
    s = s.replace(/(\d{6,}),(?=\d{6,}\b)/g, '$1, ')
  return s
}
function checked(source: SourceText, field: TranslationPath, text: string) {
  const bg = source[field] || ''
  validateTranslation({ ...source, [field]: equivalent(bg, text) }, [field], {
    [field]: equivalent(text, bg),
  })
}
function restoreList(source: string, title: string, englishTitle: string, saved: string) {
  if (source.length < 1000) throw new Error('Not a long model list')
  if ((source.match(/\d{3,}/g) || []).length < 30)
    throw new Error('Insufficient model-list evidence')
  let result = source
  const patches: { from: string; to: string; count: number }[] = []
  const add = (from: string, to: string) => {
    const matches = [
      ...result.matchAll(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')),
    ]
    if (!matches.length) return
    if (matches.some((m) => m.index! + from.length > 1024))
      throw new Error('Text occurs inside model list')
    if (matches.some((m) => result.lastIndexOf('<', m.index!) > result.lastIndexOf('>', m.index!)))
      throw new Error('Text inside HTML attribute')
    result = result.replaceAll(from, to)
    patches.push({ from, to, count: matches.length })
  }
  if (/[А-Яа-я]/u.test(title) && source.includes(title)) add(title, englishTitle)
  for (const [from, choices] of labels) {
    if (!result.includes(from)) continue
    const to = choices.find((t) => saved.toLowerCase().includes(t.toLowerCase()))
    if (!to) throw new Error('No confirmed cached header translation')
    add(from, to)
  }
  // Untranslated prose, encoded Cyrillic, or imported foreign prose needs review.
  if (/[А-Яа-яЁёІіЇїҐґЄє]/u.test(visibleTranslationText(result)))
    throw new Error('Unreviewed source prose remains')
  if (/(?:chladničky|Vhodné pro|termostat)/i.test(visibleTranslationText(result)))
    throw new Error('Foreign source prose requires review')
  return { text: result, proof: { originalHash: sha(source), resultHash: sha(result), patches } }
}
export function reviewedCandidate(job: any): any {
  try {
    if (job.errorCode !== 'TRANSLATION_VALIDATION_FAILED')
      throw new Error('Incomplete response requires separate review')
    const saved = JSON.parse(job.rawOutput)
    if (Object.keys(saved).sort().join('|') !== [...job.fields].sort().join('|'))
      throw new Error('Unexpected fields')
    if (/\bReplica\b|Read Ampoule|Ceiling Lamp|Oven Key/i.test(Object.values(saved).join('\n')))
      throw new Error('Suspicious terminology')
    const translation: Record<string, string> = {}
    const proofs: Record<string, unknown> = {}
    // Title must pass before it is used to reconstruct a description header.
    for (const f of [...job.fields].sort((a, b) =>
      a === 'description' ? 1 : b === 'description' ? -1 : 0,
    ) as TranslationPath[]) {
      let text = saved[f]
      try {
        text = normalizeSavedTranslation(job.source, [f], { [f]: text }).translation[f]
      } catch {
        try {
          checked(job.source, f, text)
        } catch (error) {
          if (f !== 'description') throw error
          const list = restoreList(
            job.source.description || '',
            job.source.title || '',
            translation.title || saved.title || '',
            text,
          )
          text = list.text
          proofs[f] = list.proof
        }
      }
      translation[f] = text
    }
    return {
      accepted: true,
      translation,
      restoredCodeFields: Object.keys(proofs),
      proof: { version: 'reviewed-equivalences-v5', lists: proofs },
    }
  } catch (e) {
    return { accepted: false, reason: (e as Error).message }
  }
}
export function assertReviewedRecovery(
  job: any,
  source: SourceText,
  fields: TranslationPath[],
  translation: unknown,
) {
  const c = reviewedCandidate({ ...job, source, fields })
  if (!c.accepted || !isDeepStrictEqual(c.translation, translation))
    throw new Error('Reviewed recovery proof failed')
}
