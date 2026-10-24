import { describe, it, expect } from 'vitest'
import {
  approvedCandidate,
  assertApprovedRecovery,
  reviewHash,
} from '../../scripts/localization/approvedRecovery'
import { sourceText, sourceFingerprint } from '../../scripts/localization/translationCore'
const source = sourceText({
  title: { bg: 'Помпа AB001234' },
  description: { bg: 'За модели AB001234 AB001234 CD009876' },
})
const job = {
  _id: 'local-review',
  errorCode: 'TRANSLATION_VALIDATION_FAILED',
  source,
  fields: ['title', 'description'],
  rawOutput: '{"title":"Pump AB001234","description":"Models AB001234"}',
}
const translation = { title: 'Pump AB001234', description: 'For models AB001234 AB001234 CD009876' }
const entry = {
  review: 'manually-reviewed-v7',
  jobId: job._id,
  sourceFingerprint: sourceFingerprint(source),
  responseHash: reviewHash(job.rawOutput),
  translation,
  translationHash: reviewHash(JSON.stringify(translation)),
  notes: { title: 'Reviewed same code.', description: 'Original complete model list retained.' },
  restoredModelLists: true,
}
describe('frozen local manual translation review', () => {
  it('accepts only the exact reviewed source, response and translation', () => {
    expect(approvedCandidate(job, entry).accepted).toBe(true)
    expect(approvedCandidate(job, undefined).accepted).toBe(false)
    expect(approvedCandidate({ ...job, _id: 'different' }, entry).accepted).toBe(false)
    expect(approvedCandidate({ ...job, rawOutput: job.rawOutput + ' ' }, entry).accepted).toBe(
      false,
    )
    expect(
      approvedCandidate({ ...job, source: { ...source, title: 'Друга помпа AB001234' } }, entry)
        .accepted,
    ).toBe(false)
    expect(
      approvedCandidate(job, { ...entry, translation: { ...translation, title: 'Pump AB001235' } })
        .accepted,
    ).toBe(false)
  })
  it('rejects extra or missing fields and unreviewed fields', () => {
    expect(approvedCandidate({ ...job, fields: ['title'] }, entry).accepted).toBe(false)
    expect(
      approvedCandidate(job, { ...entry, notes: { title: 'Only title reviewed' } }).accepted,
    ).toBe(false)
    expect(approvedCandidate({ ...job, errorCode: 'API_RESPONSE_FAILED' }, entry).accepted).toBe(
      false,
    )
  })
  it('rejects changed destinations, removed links and active markup even with a reviewed hash', () => {
    const source = sourceText({
      title: { bg: 'Помпа' },
      description: { bg: '<a href="/original">Код AB001234</a>' },
    })
    const j = { ...job, source }
    for (const description of [
      '<a href="/other">Code AB001234</a>',
      '<a href=/other>Code AB001234</a>',
      'Code AB001234',
      '<a href="/original" onclick="bad()">Code AB001234</a>',
    ]) {
      const t = { ...translation, description }
      expect(
        approvedCandidate(j, {
          ...entry,
          sourceFingerprint: sourceFingerprint(source),
          translation: t,
          translationHash: reviewHash(JSON.stringify(t)),
        }).accepted,
      ).toBe(false)
    }
  })
  it('rechecks the frozen review at write time and rejects modified model lists', () => {
    expect(() =>
      assertApprovedRecovery(job, entry, source, ['title', 'description'], translation),
    ).not.toThrow()
    expect(() =>
      assertApprovedRecovery(job, entry, source, ['title', 'description'], {
        ...translation,
        description: 'For models AB001234',
      }),
    ).toThrow()
  })
  it('permits semantic empty source fields but does not empty meaningful source fields', () => {
    const j = {
      ...job,
      source: sourceText({ title: { bg: 'Помпа' }, description: { bg: '&nbsp;' } }),
    }
    const t = { title: 'Pump', description: '' }
    const e = {
      ...entry,
      sourceFingerprint: sourceFingerprint(j.source),
      translation: t,
      translationHash: reviewHash(JSON.stringify(t)),
    }
    expect(approvedCandidate(j, e).accepted).toBe(true)
    expect(
      approvedCandidate(job, { ...e, sourceFingerprint: sourceFingerprint(source) }).accepted,
    ).toBe(false)
  })
})
