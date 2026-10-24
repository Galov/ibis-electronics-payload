import { describe, expect, it } from 'vitest'
import {
  incompleteCandidate,
  parseIncompleteObject,
  assertIncompleteReconstruction,
} from '../../scripts/localization/incompleteRecovery'
import { sourceText } from '../../scripts/localization/translationCore'

const description = Array.from(
  { length: 100 },
  (_, i) => `<div>AB${100000 + i} MODEL${200000 + i}</div>`,
).join('\n')
const job = {
  sku: '148IG40',
  customId: 'local-test',
  fields: ['title', 'description'] as const,
  source: sourceText({ title: { bg: 'WHIRLPOOL' }, description: { bg: description } }),
}
const row = {
  custom_id: job.customId,
  response: {
    status_code: 200,
    body: {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: '{"title":"WHIRLPOOL","description":"AB100000 MODEL200000',
            },
          ],
        },
      ],
    },
  },
}
const candidate = (j = job, r = row) => incompleteCandidate({ ...j, fields: [...j.fields] }, r)
describe('offline incomplete response recovery', () => {
  it('copies the entire original model list instead of completing the truncated text', () => {
    const result = candidate()
    expect(result.accepted).toBe(true)
    expect(result.translation.description).toBe(description)
    expect(result.proof.patches).toEqual([])
  })
  it('uses a reviewed cached label while preserving model codes and original markup', () => {
    const localJob = {
      ...job,
      sku: '152ID01',
      source: sourceText({
        title: { bg: 'WHIRLPOOL' },
        description: { bg: '<div>За модели :</div>' + description },
      }),
    }
    const localRow = structuredClone(row)
    localRow.response.body.output[0].content[0].text =
      '{"title":"WHIRLPOOL","description":"<div>Compatible models:</div>AB100000'
    const result = candidate(localJob, localRow)
    expect(result.accepted).toBe(true)
    expect(result.translation.description).toBe('<div>Compatible models :</div>' + description)
  })
  it('rejects mismatched response identities and unreviewed products', () => {
    expect(candidate(job, { ...row, custom_id: 'other' }).accepted).toBe(false)
    expect(candidate({ ...job, sku: 'unknown' }).accepted).toBe(false)
    expect(candidate({ ...job, sku: '304CU10' }).accepted).toBe(false)
  })
  it('does not accept an incomplete title or guess an unfinished escape', () => {
    expect(parseIncompleteObject('{"title":"unfinished').title.complete).toBe(false)
    expect(parseIncompleteObject('{"title":"A","description":"B\\u00').description.value).toBe('B')
    expect(() => parseIncompleteObject('{"title":"A","title":"B"}')).toThrow()
  })
  it('rejects modified model lists even after generating a recovery candidate', () => {
    const result = candidate()
    expect(() =>
      assertIncompleteReconstruction(
        { ...job, fields: [...job.fields] },
        row,
        job.source,
        [...job.fields],
        result.translation,
      ),
    ).not.toThrow()
    expect(() =>
      assertIncompleteReconstruction(
        { ...job, fields: [...job.fields] },
        row,
        job.source,
        [...job.fields],
        { ...result.translation, description: description.replace('AB100000', 'AB999999') },
      ),
    ).toThrow()
  })
})
