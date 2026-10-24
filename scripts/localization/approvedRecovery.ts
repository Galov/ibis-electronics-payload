import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import {
  sourceFingerprint,
  isEmptyProductText,
  type SourceText,
  type TranslationPath,
} from './translationCore'
export const reviewHash = (value: string) => createHash('sha256').update(value).digest('hex')
const references = (text: string) =>
  [...text.matchAll(/\b(?:href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)].map((m) => m[0]).sort()
export function approvedCandidate(job: any, entry: any): any {
  try {
    if (!entry || entry.review !== 'manually-reviewed-v7')
      throw new Error('Separate source review required')
    if (
      job.errorCode !== 'TRANSLATION_VALIDATION_FAILED' ||
      entry.jobId !== job._id ||
      entry.sourceFingerprint !== sourceFingerprint(job.source) ||
      entry.responseHash !== reviewHash(job.rawOutput || '')
    )
      throw new Error('Reviewed source or saved response changed')
    if (!isDeepStrictEqual([...job.fields].sort(), Object.keys(entry.translation).sort()))
      throw new Error('Reviewed fields do not match')
    if (entry.translationHash !== reviewHash(JSON.stringify(entry.translation)))
      throw new Error('Reviewed translation changed')
    for (const f of job.fields) {
      const text = entry.translation[f]
      if (
        typeof text !== 'string' ||
        (!text.trim() && !isEmptyProductText(job.source[f])) ||
        !entry.notes[f]
      )
        throw new Error('Missing reviewed field or explanation')
      if (!isDeepStrictEqual(references(job.source[f] || ''), references(text)))
        throw new Error('Reviewed links or images changed')
      if (/<script\b|\bon[a-z]+\s*=/i.test(text))
        throw new Error('Active markup is not allowed in reviewed translations')
    }
    return {
      accepted: true,
      translation: entry.translation,
      restoredCodeFields: entry.restoredModelLists ? ['description'] : [],
      proof: {
        version: 'manually-reviewed-v7',
        translationHash: entry.translationHash,
        notes: entry.notes,
      },
    }
  } catch (e) {
    return { accepted: false, reason: (e as Error).message }
  }
}
export function assertApprovedRecovery(
  job: any,
  entry: any,
  source: SourceText,
  fields: TranslationPath[],
  translation: unknown,
) {
  const c = approvedCandidate({ ...job, source, fields }, entry)
  if (!c.accepted || !isDeepStrictEqual(c.translation, translation))
    throw new Error('Manual review proof failed')
}
