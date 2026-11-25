import { translationState } from '@/translations/state'
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { sourceText, sourceFingerprint, readPath } from '../../scripts/localization/translationCore'
import {
  englishText,
  englishHash,
  bundleHash,
  transferDecision,
  reconcileTranslations,
  validateBundle,
  type TranslationBundle,
} from '@/translations/transfer'
import {
  prepareProductTranslation,
  runProductTranslation,
  type TranslationStore,
  type TranslationJob,
  type TranslationState,
} from '@/translations/engine'
import {
  queueEnglishProductTranslation,
  englishTranslationQueueEnabled,
} from '@/translations/tasks'

const id = '0123456789abcdef01234567'
const product = () => ({
  _id: id,
  id,
  sku: 'AB123',
  slug: 'stable',
  price: 10,
  stockQty: 9,
  images: ['image'],
  title: { bg: 'Амортисьор 120N' } as { bg: string; en?: string },
  description: { bg: 'Код C00303589.' },
  shortDescription: { bg: null },
  meta: { title: { bg: null }, description: { bg: null }, image: 'shared' },
  sync: { id: 'unchanged' },
})
const translated = { title: 'Shock absorber 120N', description: 'Code C00303589.' }
function bundle(): TranslationBundle {
  const p = product(),
    source = sourceText(p)
  const entries = [
    {
      productId: id,
      sku: p.sku,
      source,
      fingerprint: sourceFingerprint(source),
      english: { ...englishText(p), ...translated },
    },
  ]
  return {
    format: 'ibis-approved-english-v1',
    createdAt: '2026-11-25',
    entries,
    contentHash: bundleHash(entries),
  }
}
function memory(p: Record<string, unknown> | null = product()) {
  const data = {
    p,
    state: null as TranslationState | null,
    jobs: new Map<string, TranslationJob>(),
    held: false,
  }
  const store: TranslationStore = {
    product: async () => structuredClone(data.p),
    state: async () => structuredClone(data.state),
    reviewHold: async () => data.held,
    job: async (key) => structuredClone(data.jobs.get(key) || null),
    insert: async (job) => {
      if (data.jobs.has(job.id)) return false
      data.jobs.set(job.id, structuredClone(job))
      return true
    },
    mark: async (key, values) => {
      Object.assign(data.jobs.get(key)!, structuredClone(values))
    },
    claim: async (key) => {
      const job = data.jobs.get(key)!
      if (job.status !== 'pending') return false
      job.status = 'requesting'
      job.requestedAt = new Date().toISOString()
      return true
    },
    commit: async (job, patch, english) => {
      if (
        !data.p ||
        sourceFingerprint(sourceText(data.p)) !== job.fingerprint ||
        englishHash(englishText(data.p)) !== englishHash(job.before)
      )
        return false
      for (const [path, value] of Object.entries(patch)) {
        const parts = path.split('.')
        const key = parts.pop()!
        let parent = data.p as Record<string, unknown>
        for (const part of parts) {
          if (!parent[part]) parent[part] = {}
          parent = parent[part] as Record<string, unknown>
        }
        parent[key] = value
      }
      data.state = {
        ...translationState(id, job.fingerprint, job.source, english),
        lastJobId: job.id,
      }
      data.jobs.get(job.id)!.status = 'completed'
      return true
    },
  }
  return { data, store }
}
const provider = () => vi.fn(async () => translated)
afterEach(() => vi.unstubAllEnvs())
describe('English-only transfer and reconciliation', () => {
  it('copies only allowlisted EN text, detects missing/changed/deleted products', () => {
    const b = bundle()
    validateBundle(b)
    const decision = transferDecision(product(), b.entries[0])
    expect(decision.status).toBe('copy')
    expect(Object.keys(decision.patch!)).toEqual(['title.en', 'description.en'])
    const changed = product()
    changed.title.bg = 'Амортисьор 140N'
    expect(transferDecision(changed, b.entries[0]).status).toBe('source_changed')
    expect(reconcileTranslations([], b)[0].status).toBe('deleted_since_export')
    const newProduct = { ...product(), _id: 'abcdef0123456789abcdef01' }
    expect(reconcileTranslations([product(), newProduct], b).map((row) => row.status)).toEqual([
      'copy',
      'new_since_export',
    ])
  })
  it('preserves existing English edits and refuses unmatched SKU or unmigrated BG', () => {
    const b = bundle(),
      p = product()
    p.title.en = 'Manual English'
    expect(transferDecision(p, b.entries[0]).status).toBe('english_conflict')
    expect(transferDecision({ ...product(), sku: 'OTHER' }, b.entries[0]).status).toBe(
      'identity_changed',
    )
    expect(transferDecision({ ...product(), title: 'BG title' }, b.entries[0]).status).toBe(
      'requires_migration',
    )
    const unsafe = structuredClone(b)
    unsafe.entries[0].english.price = '1'
    unsafe.contentHash = bundleHash(unsafe.entries)
    expect(() => validateBundle(unsafe)).toThrow('Unsafe')
    expect(() => validateBundle({ ...b, contentHash: 'bad' })).toThrow()
  })
  it('keeps held records separate from genuinely new products', () => {
    const b = bundle()
    b.entries = []
    b.contentHash = bundleHash([])
    b.excluded = [{ productId: id, status: 'needs_review' }]
    expect(reconcileTranslations([product()], b)).toEqual([
      { productId: id, status: 'needs_review' },
    ])
  })
})
describe('durable product translation engine', () => {
  it('reuses the saved response on repeated A -> B -> A changes without leaving the B translation', async () => {
    const {data,store}=memory()
    const first=await prepareProductTranslation(store,id)
    await runProductTranslation(store,first.jobId!,provider())
    const call=vi.fn(async()=>({title:'Shock absorber 140N'}))
    for(let i=0;i<2;i++){
      ;(data.p!.title as {bg:string}).bg='Амортисьор 140N'
      const b=await prepareProductTranslation(store,id)
      await runProductTranslation(store,b.jobId!,call)
      expect(readPath(data.p,'title.en')).toBe('Shock absorber 140N')
      ;(data.p!.title as {bg:string}).bg='Амортисьор 120N'
      const a=await prepareProductTranslation(store,id)
      await runProductTranslation(store,a.jobId!,call)
      expect(readPath(data.p,'title.en')).toBe('Shock absorber 120N')
    }
    expect(call).toHaveBeenCalledTimes(1)
  })
  it('translates a new product once and leaves all commerce data unchanged', async () => {
    const { data, store } = memory(),
      call = provider()
    const before = structuredClone(data.p)
    const job = await prepareProductTranslation(store, id)
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('completed')
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('completed')
    expect(call).toHaveBeenCalledTimes(1)
    expect(readPath(data.p, 'title.en')).toBe(translated.title)
    for (const key of ['sku', 'slug', 'price', 'stockQty', 'images', 'sync'])
      expect(data.p![key]).toEqual(before![key])
    expect(readPath(data.p, 'meta.image')).toBe('shared')
    expect(sourceText(data.p)).toEqual(sourceText(before))
  })
  it('queues only changed text and ignores price/stock changes', async () => {
    const { data, store } = memory()
    const job = await prepareProductTranslation(store, id)
    await runProductTranslation(store, job.jobId!, provider())
    data.p!.price = 20
    data.p!.stockQty = 4
    expect((await prepareProductTranslation(store, id)).status).toBe('already_ready')
    ;(data.p!.title as { bg: string }).bg = 'Амортисьор 140N'
    const next = await prepareProductTranslation(store, id)
    expect(data.jobs.get(next.jobId!)!.fields).toEqual(['title'])
    const call = vi.fn(async () => ({ title: 'Shock absorber 140N' }))
    expect(await runProductTranslation(store, next.jobId!, call)).toBe('completed')
    expect(readPath(data.p, 'description.en')).toBe(translated.description)
  })
  it('never overwrites manual or untracked EN edits and respects review holds', async () => {
    const { data, store } = memory()
    const job = await prepareProductTranslation(store, id)
    await runProductTranslation(store, job.jobId!, provider())
    ;(data.p!.title as { en: string }).en = 'Manual edit'
    expect((await prepareProductTranslation(store, id)).status).toBe('manual_review')
    const untracked = memory({ ...product(), title: { bg: 'Амортисьор 120N', en: 'Existing' } })
    expect((await prepareProductTranslation(untracked.store, id)).status).toBe('untracked_english')
    const held = memory()
    held.data.held = true
    expect((await prepareProductTranslation(held.store, id)).status).toBe('manual_review')
  })
  it('does not contact a provider while disabled and resumes from a saved response for free', async () => {
    const { data, store } = memory(),
      job = await prepareProductTranslation(store, id)
    expect(await runProductTranslation(store, job.jobId!)).toBe('api_disabled')
    Object.assign(data.jobs.get(job.jobId!)!, { status: 'response_saved', translation: translated })
    const call = provider()
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('completed')
    expect(call).not.toHaveBeenCalled()
  })
  it('retains suspicious response for review without repeat charges', async () => {
    const { data, store } = memory(),
      job = await prepareProductTranslation(store, id)
    const call = vi.fn(async () => ({
      title: 'Shock absorber 999N',
      description: 'Code C00303589.',
    }))
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('needs_review')
    expect(data.jobs.get(job.jobId!)!.translation).toBeTruthy()
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('needs_review')
    expect(call).toHaveBeenCalledTimes(1)
  })
  it('protects against a text edit while the API is running', async () => {
    const { data, store } = memory(),
      job = await prepareProductTranslation(store, id)
    const call = vi.fn(async () => {
      ;(data.p!.title as { bg: string }).bg = 'Ново 140N'
      return translated
    })
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('stale')
    expect(readPath(data.p, 'title.en')).toBeUndefined()
  })
  it('marks ambiguous paid failures without retrying the API', async () => {
    const { store } = memory(),
      job = await prepareProductTranslation(store, id)
    const call = vi.fn(async () => {
      throw Error('timeout')
    })
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('request_unknown')
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('request_unknown')
    expect(call).toHaveBeenCalledTimes(1)
  })
  it('prevents duplicate requests while another claimant is working', async () => {
    const { data, store } = memory(),
      job = await prepareProductTranslation(store, id)
    Object.assign(data.jobs.get(job.jobId!)!, {
      status: 'requesting',
      requestedAt: new Date().toISOString(),
    })
    const call = provider()
    expect(await runProductTranslation(store, job.jobId!, call)).toBe('busy')
    expect(call).not.toHaveBeenCalled()
  })
})
describe('NIK/admin product hooks', () => {
  it('is off by default and refuses unapproved database activation', () => {
    vi.stubEnv('IBIS_EN_TRANSLATION_QUEUE_ENABLED', 'false')
    expect(englishTranslationQueueEnabled()).toBe(false)
    vi.stubEnv('IBIS_EN_TRANSLATION_QUEUE_ENABLED', 'true')
    vi.stubEnv('IBIS_PRODUCT_LOCALIZATION_PREVIEW', 'true')
    vi.stubEnv('DATABASE_URL', 'mongodb://production/db')
    expect(() => englishTranslationQueueEnabled()).toThrow('isolated')
  })
  it('queues creation/BG text edits, ignores price-only and EN changes, threads req', async () => {
    vi.stubEnv('IBIS_EN_TRANSLATION_QUEUE_ENABLED', 'true')
    vi.stubEnv('IBIS_PRODUCT_LOCALIZATION_PREVIEW', 'true')
    vi.stubEnv('IBIS_LOCAL_PREVIEW', 'true')
    vi.stubEnv(
      'DATABASE_URL',
      'mongodb://127.0.0.1:27028/ibis_bg_en_test?replicaSet=ibisEnLocal&directConnection=true',
    )
    const queue = vi.fn(),
      req = { locale: 'bg', payload: { jobs: { queue } } }
    const before = { id, title: 'Old', description: 'Text' }
    const call = (doc: object, operation: string, locale = 'bg') =>
      queueEnglishProductTranslation({
        doc,
        previousDoc: before,
        operation,
        req: { ...req, locale },
        context: {},
      } as unknown as Parameters<typeof queueEnglishProductTranslation>[0])
    await call(before, 'create')
    expect(queue).toHaveBeenCalledTimes(1)
    expect(queue.mock.calls[0][0]).toMatchObject({
      input: { productId: id },
      req: expect.objectContaining({ locale: 'bg' }),
    })
    await call({ ...before, price: 12, stockQty: 1 }, 'update')
    expect(queue).toHaveBeenCalledTimes(1)
    await call({ ...before, title: 'New' }, 'update', 'en')
    expect(queue).toHaveBeenCalledTimes(1)
    await call({ ...before, title: 'New' }, 'update')
    expect(queue).toHaveBeenCalledTimes(2)
  })
})

describe('assembled current English release', () => {
  it('includes checked delta and excludes stale, identity-changed and deleted originals', async () => {
    const { assembleEnglishRelease } = await import('@/translations/assembleRelease')
    const original = bundle(),
      delta = bundle()
    delta.entries[0].source.title = 'Амортисьор 140N'
    delta.entries[0].fingerprint = sourceFingerprint(delta.entries[0].source)
    delta.entries[0].english.title = 'Shock absorber 140N'
    delta.contentHash = bundleHash(delta.entries)
    const report = {
      rows: [
        { productId: id, status: 'source_changed', fingerprint: delta.entries[0].fingerprint },
      ],
    }
    const ready = assembleEnglishRelease(original, delta, report)
    expect(ready.entries).toHaveLength(1)
    expect(ready.entries[0].english.title).toBe('Shock absorber 140N')
    expect(() =>
      assembleEnglishRelease(original, delta, {
        rows: [{ productId: id, status: 'identity_changed' }],
      }),
    ).toThrow()
    const empty = { ...delta, entries: [], contentHash: bundleHash([]) }
    expect(assembleEnglishRelease(original, empty, report).entries).toHaveLength(0)
    expect(assembleEnglishRelease(original, empty, report).excluded![0].status).toBe('needs_review')
  })
  it('compares an unmigrated snapshot without modifying it or requesting any API', async () => {
    const { compareSnapshot } =
      await import('../../scripts/localization/reconcileEnglishSnapshot.mjs')
    const source = [{ ...product(), title: 'Амортисьор 120N' }]
    const before = structuredClone(source)
    const report = compareSnapshot(source, bundle())
    expect(report.counts.ready_to_transfer).toBe(1)
    expect(report.rows[0].requiresMigration).toBe(true)
    expect(source).toEqual(before)
    const changed = [{ ...source[0], title: 'Амортисьор 140N' }]
    expect(compareSnapshot(changed, bundle()).rows[0].translateFields).toEqual(['title'])
  })
})

describe('explicit written-out measurement equivalence', () => {
  it('accepts liters/meters and hyphenated unit wording without inventing missing units', async () => {
    const { validateTranslation } = await import('../../scripts/localization/translationCore')
    const source = {
      ...sourceText(product()),
      title: 'Уплътнение 7-8 л.',
      description: 'Дължина 1.5 метра. Обем 50 литра.',
    }
    expect(() =>
      validateTranslation(source, ['title', 'description'], {
        title: 'Gasket 7-8 Liters',
        description: 'Length 1.5 meters. Volume 50-liter.',
      }),
    ).not.toThrow()
    expect(() =>
      validateTranslation({ ...source, description: 'Размер 10x2.5' }, ['description'], {
        description: 'Dimensions 10x2.5 cm',
      }),
    ).toThrow()
  })
})
