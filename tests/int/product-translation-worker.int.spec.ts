import { describe, expect, it, vi } from 'vitest'
import {
  assertLocalTranslationURI,
  localTranslationURI,
  sourceText,
  sourceFingerprint,
  missingEnglishFields,
  translationRequest,
  validateTranslation,
  englishPatch,
  batchCustomID,
} from '../../scripts/localization/translationCore'
import { applySavedTranslation } from '../../scripts/localization/translateProducts.mjs'

const product = () => ({
  _id: 'product',
  sku: 'SKU',
  price: 12,
  stockQty: 3,
  title: { bg: 'Амортисьор 120N' },
  description: { bg: 'Размер 165 mm. Код C00303589.' },
  shortDescription: { bg: null },
  slug: 'stable',
  meta: { title: { bg: 'Амортисьор' }, image: 'shared-image' },
  catalogSync: { lastSuccessfulEventId: 'event' },
})
const fixture = () => {
  const p = product()
  const source = sourceText(p)
  const fields = missingEnglishFields(p, source)
  return {
    p,
    job: {
      _id: 'job',
      productId: 'product',
      source,
      fingerprint: sourceFingerprint(source),
      fields,
      enBefore: Object.fromEntries(fields.map((p) => [p, null])),
      translation: {
        title: 'Shock absorber 120N',
        description: 'Size 165 mm. Code C00303589.',
        'meta.title': 'Shock absorber',
      },
    },
  }
}
function database(p: ReturnType<typeof product>, matchedCount = 1) {
  const updateJob = vi.fn(async () => ({ matchedCount: 1 }))
  const updateProduct = vi.fn(async () => ({ matchedCount }))
  return {
    db: {
      collection: (name: string) =>
        name === 'products'
          ? { findOne: vi.fn(async () => p), updateOne: updateProduct }
          : { updateOne: updateJob },
    },
    updateJob,
    updateProduct,
  }
}

describe('local bulk translation safeguards', () => {
  it('refuses any database address other than the isolated test URI', () => {
    expect(() => assertLocalTranslationURI(localTranslationURI)).not.toThrow()
    for (const uri of [
      'mongodb+srv://production/database',
      'mongodb://127.0.0.1:27028/other',
      'mongodb://localhost:27028/ibis_bg_en_test',
    ])
      expect(() => assertLocalTranslationURI(uri)).toThrow('isolated local')
  })
  it('skips complete EN fields, including partially translated products', () => {
    const p = product()
    const source = sourceText(p)
    Object.assign(p.title, { en: 'Existing human title' })
    expect(missingEnglishFields(p, source)).toEqual(['description', 'meta.title'])
    Object.assign(p.description, { en: 'Existing description' })
    Object.assign(p.meta.title, { en: 'Existing SEO' })
    expect(missingEnglishFields(p, source)).toEqual([])
  })
  it('hashes only BG text, not price, stock, EN or timestamps', () => {
    const p = product()
    const before = sourceFingerprint(sourceText(p))
    p.price = 20
    p.stockQty = 0
    Object.assign(p.title, { en: 'New EN' })
    expect(sourceFingerprint(sourceText(p))).toBe(before)
    p.title.bg = 'Different BG'
    expect(sourceFingerprint(sourceText(p))).not.toBe(before)
  })
  it('sends only missing product text, never customer or commercial data', () => {
    const source = sourceText(product())
    const request = translationRequest(source, ['title'])
    expect(JSON.parse(request.input)).toEqual({ title: 'Амортисьор 120N' })
    expect(request.store).toBe(false)
    expect(request.text.format.schema.required).toEqual(['title'])
    expect(JSON.stringify(request)).not.toMatch(/catalogSync|stockQty|lastSuccessfulEventId/)
  })
  it('rejects non-localized data and missing titles before sending a request', () => {
    expect(() => sourceText({ ...product(), title: 'Unmigrated' })).toThrow('Unmigrated')
    expect(() => sourceText({ ...product(), title: { bg: '' } })).toThrow('Missing BG')
  })
  it('holds malformed, numerically changed or link-altered results for review', () => {
    const source = sourceText(product())
    expect(() =>
      validateTranslation(source, ['title'], { title: 'Shock absorber 120N' }),
    ).not.toThrow()
    expect(() => validateTranslation(source, ['title'], { title: 'Shock absorber 100N' })).toThrow(
      'Numeric',
    )
    expect(() =>
      validateTranslation(source, ['title'], { title: 'Shock absorber 120N', price: 99 }),
    ).toThrow('Unexpected')
    expect(() => validateTranslation(source, ['title'], { title: '' })).toThrow('Empty')
    expect(() =>
      validateTranslation({ ...source, title: '<a href="/original">Име</a>' }, ['title'], {
        title: 'Name',
      }),
    ).toThrow('HTML')
  })
  it('creates patches exclusively for allowed EN text paths', () => {
    expect(englishPatch({ title: 'Name' })).toEqual({ 'title.en': 'Name' })
    for (const field of ['price', 'title.bg', 'meta.image', '__proto__.x'])
      expect(() => englishPatch({ [field]: 'unsafe' })).toThrow('Unsafe')
  })
  it('maps unordered batch results by a stable unique identity', () => {
    const a = batchCustomID('012345678901234567890123', 'a'.repeat(64))
    expect(a).toHaveLength(58)
    expect(batchCustomID('012345678901234567890123', 'a'.repeat(64))).toBe(a)
    expect(batchCustomID('012345678901234567890123', 'b'.repeat(64))).not.toBe(a)
  })
  it('replays a durable response without an API call and writes only EN fields', async () => {
    const { p, job } = fixture()
    const { db, updateProduct, updateJob } = database(p)
    await applySavedTranslation(db, job)
    expect(updateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'product', $and: expect.any(Array) }),
      {
        $set: {
          'title.en': 'Shock absorber 120N',
          'description.en': 'Size 165 mm. Code C00303589.',
          'meta.title.en': 'Shock absorber',
        },
      },
    )
    expect(updateJob).toHaveBeenCalledWith(
      { _id: 'job' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) }),
    )
  })
  it('recognizes a product saved before the journal was marked complete', async () => {
    const { p, job } = fixture()
    Object.assign(p.title, { en: job.translation.title })
    Object.assign(p.description, { en: job.translation.description })
    Object.assign(p.meta.title, { en: job.translation['meta.title'] })
    const { db, updateProduct, updateJob } = database(p)
    await applySavedTranslation(db, job)
    expect(updateProduct).not.toHaveBeenCalled()
    expect(updateJob).toHaveBeenCalledWith(
      { _id: 'job' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) }),
    )
  })
  it('does not overwrite source edits or human translations made during the request', async () => {
    for (const change of ['bg', 'en']) {
      const { p, job } = fixture()
      if (change === 'bg') p.title.bg = 'New BG'
      else Object.assign(p.title, { en: 'Human edit' })
      const { db, updateProduct } = database(p)
      expect(await applySavedTranslation(db, job)).toBe(false)
      expect(updateProduct).not.toHaveBeenCalled()
    }
  })
  it('detects a concurrent source update at the atomic write boundary', async () => {
    const { p, job } = fixture()
    const { db, updateProduct, updateJob } = database(p, 0)
    expect(await applySavedTranslation(db, job)).toBe(false)
    expect(updateProduct).toHaveBeenCalledOnce()
    expect(updateJob).toHaveBeenCalledWith(
      { _id: 'job' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'stale_source' }) }),
    )
  })
})

describe('paid batch submission recovery', () => {
  it('reconciles a lost create response instead of submitting a second paid batch', async () => {
    const { submit, reconcileSubmission } =
      await import('../../scripts/localization/translateProducts.mjs')
    const { job } = fixture()
    const batch = {
      _id: 'batch-local',
      status: 'uploaded',
      jobIds: [job._id],
      inputFileId: 'file-input',
    }
    const updateBatch = vi.fn(async () => ({ matchedCount: 1 }))
    const db = {
      collection: (name: string) =>
        name === 'local_translation_jobs'
          ? {
              find: () => ({ sort: () => ({ toArray: async () => [job] }) }),
              updateMany: vi.fn(async () => ({ matchedCount: 1 })),
            }
          : { updateOne: updateBatch },
    }
    const create = vi.fn(async () => {
      throw new Error('Connection lost after request reached server')
    })
    await submit(db, batch, create)
    expect(create).toHaveBeenCalledOnce()
    expect(updateBatch).toHaveBeenLastCalledWith(
      { _id: 'batch-local' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'submission_unknown' }) }),
    )
    const list = vi.fn(async () =>
      Response.json({
        data: [{ id: 'batch-remote', metadata: { local_batch_id: 'batch-local' } }],
        has_more: false,
      }),
    )
    await reconcileSubmission(db, batch, list)
    expect(list).toHaveBeenCalledWith('/v1/batches?limit=100')
    expect(updateBatch).toHaveBeenLastCalledWith(
      { _id: 'batch-local' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'active', remoteId: 'batch-remote' }),
      }),
    )
    expect(create).toHaveBeenCalledOnce()
  })
  it('holds an unknown submission rather than silently creating it again', async () => {
    const { reconcileSubmission } = await import('../../scripts/localization/translateProducts.mjs')
    const update = vi.fn(async () => ({ matchedCount: 1 }))
    const db = { collection: () => ({ updateOne: update }) }
    const list = vi.fn(async () => Response.json({ data: [], has_more: false }))
    await reconcileSubmission(db, { _id: 'unknown' }, list)
    expect(list).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith(
      { _id: 'unknown' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'submission_unknown' }) }),
    )
  })
})
