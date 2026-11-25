import { textHash } from './state'
import {
  sourceText,
  sourceFingerprint,
  translationPaths,
  translationRequest,
  validateTranslation,
  isEmptyProductText,
  type SourceText,
  type TranslationPath,
} from '../../scripts/localization/translationCore'
import { englishText, englishHash, type EnglishText } from './transfer'
export type TranslationState = {
  lastJobId?: string
  sku?: string | null
  productId: string
  fingerprint: string
  sourceHashes: Record<string, string>
  englishHash: string
}
export type TranslationJob = {
  sku?: string | null
  id: string
  productId: string
  fingerprint: string
  source: SourceText
  before: EnglishText
  fields: TranslationPath[]
  clear: TranslationPath[]
  status:
    | 'pending'
    | 'requesting'
    | 'response_saved'
    | 'completed'
    | 'stale'
    | 'needs_review'
    | 'request_unknown'
  translation?: Record<string, string>
  error?: string
  requestedAt?: string
  providerResponse?: unknown
}
export interface TranslationStore {
  product(id: string): Promise<Record<string, unknown> | null>
  state(id: string): Promise<TranslationState | null>
  reviewHold?(id: string, fingerprint?: string): Promise<boolean>
  job(id: string): Promise<TranslationJob | null>
  insert(job: TranslationJob): Promise<boolean>
  mark(id: string, values: Partial<TranslationJob>): Promise<void>
  claim(id: string): Promise<boolean>
  commit(
    job: TranslationJob,
    patch: Record<string, string | null>,
    english: EnglishText,
  ): Promise<boolean>
}
export class SavedTranslationResponseError extends Error {
  constructor(public response: unknown) {
    super('Translation response needs review')
  }
}
export type TranslationProvider = (
  request: ReturnType<typeof translationRequest>,
) => Promise<Record<string, string>>
export async function prepareProductTranslation(store: TranslationStore, productId: string) {
  const product = await store.product(productId)
  if (!product) return { status: 'deleted' }
  let source: SourceText
  try {
    source = sourceText(product)
  } catch {
    return { status: 'invalid_source' }
  }
  const before = englishText(product)
  const fingerprint = sourceFingerprint(source)
  const state = await store.state(productId)
  if (state && Object.hasOwn(state, 'sku') && state.sku !== (product.sku ?? null))
    return { status: 'manual_review' }
  if (!state && (await store.reviewHold?.(productId, fingerprint))) return { status: 'manual_review' }
  if (state && state.englishHash !== englishHash(before)) return { status: 'manual_review' }
  if (!state && Object.values(before).some((value) => value?.trim()))
    return { status: 'untracked_english' }
  if (state?.fingerprint === fingerprint) return { status: 'already_ready' }
  const fields = translationPaths.filter(
    (path) =>
      !isEmptyProductText(source[path]) &&
      (!state || textHash(source[path]) !== state.sourceHashes[path] || !before[path]?.trim()),
  )
  const clear = translationPaths.filter(
    (path) => isEmptyProductText(source[path]) && !!before[path],
  )
  const baseId = `${productId}:${fingerprint}`
  const cached = await store.job(baseId)
  // A -> B -> A must not return an old completed job while EN still contains B.
  const newOccurrence = cached && (cached.status === 'completed' ||
    (englishHash(cached.before) !== englishHash(before) && ['pending', 'stale', 'response_saved'].includes(cached.status)))
  const id = newOccurrence
    ? `${baseId}:${textHash(state?.lastJobId || `${state?.fingerprint}:${state?.englishHash}`)}`
    : baseId
  const job = newOccurrence ? await store.job(id) : cached
  if (job) return { status: job.status, jobId: id }
  const reusable = cached?.status === 'completed' && fields.every(path => typeof cached.translation?.[path] === 'string')
  await store.insert({
    id,
    productId,
    sku: (product.sku as string | null | undefined) ?? null,
    fingerprint,
    source,
    before,
    fields,
    clear,
    status: reusable ? 'response_saved' : 'pending',
    ...(reusable ? { translation: Object.fromEntries(fields.map(path => [path, cached.translation![path]])) } : {}),
  })
  return { status: reusable ? 'response_saved' : 'pending', jobId: id }
}
export async function runProductTranslation(
  store: TranslationStore,
  id: string,
  provider?: TranslationProvider,
) {
  let job = await store.job(id)
  if (!job) return 'missing_job'
  if (
    job.status === 'completed' ||
    job.status === 'needs_review' ||
    job.status === 'stale' ||
    job.status === 'request_unknown'
  )
    return job.status
  if (job.status === 'requesting') {
    if (job.requestedAt && Date.now() - Date.parse(job.requestedAt) < 15 * 60_000) return 'busy'
    // A crashed/ambiguous paid request must never be submitted again automatically.
    await store.mark(id, { status: 'request_unknown' })
    return 'request_unknown'
  }
  const product = await store.product(job.productId)
  let current: SourceText | undefined
  try {
    if (product) current = sourceText(product)
  } catch {
    /* guarded below */
  }
  if (!product || !current || sourceFingerprint(current) !== job.fingerprint) {
    await store.mark(id, { status: 'stale' })
    return 'stale'
  }
  if (Object.hasOwn(job, 'sku') && job.sku !== (product.sku ?? null)) {
    await store.mark(id, { status: 'needs_review', error: 'SKU_CHANGED' })
    return 'needs_review'
  }
  if (englishHash(englishText(product)) !== englishHash(job.before)) {
    await store.mark(id, { status: 'needs_review', error: 'EN_CHANGED' })
    return 'needs_review'
  }
  if (job.status === 'pending') {
    if (job.fields.length && !provider) return 'api_disabled'
    if (!(await store.claim(id))) return 'busy'
    try {
      const translation = job.fields.length
        ? await provider!(translationRequest(job.source, job.fields))
        : {}
      // Save before validation/application. Recovery reuses this response without another charge.
      await store.mark(id, { status: 'response_saved', translation })
      job = { ...job, status: 'response_saved', translation }
    } catch (error) {
      if (error instanceof SavedTranslationResponseError) {
        await store.mark(id, {
          status: 'needs_review',
          error: 'INCOMPLETE_PROVIDER_RESPONSE',
          providerResponse: error.response,
        })
        return 'needs_review'
      }
      await store.mark(id, { status: 'request_unknown', error: 'PROVIDER_OUTCOME_UNKNOWN' })
      return 'request_unknown'
    }
  }
  try {
    validateTranslation(job.source, job.fields, job.translation)
  } catch {
    await store.mark(id, { status: 'needs_review', error: 'TECHNICAL_VALIDATION' })
    return 'needs_review'
  }
  const patch = Object.fromEntries([
    ...Object.entries(job.translation || {}).map(([path, text]) => [`${path}.en`, text]),
    ...job.clear.map((path) => [`${path}.en`, null]),
  ])
  const english = { ...job.before, ...job.translation }
  for (const path of job.clear) english[path] = null
  if (!(await store.commit(job, patch, english))) {
    await store.mark(id, { status: 'stale' })
    return 'stale'
  }
  return 'completed'
}
