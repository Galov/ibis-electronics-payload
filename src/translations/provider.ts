import { SavedTranslationResponseError, type TranslationProvider } from './engine'
/** No SDK install, no retries of ambiguous paid requests, no secrets in diagnostics. */
export const openAITranslationProvider: TranslationProvider = async (request) => {
  if (process.env.IBIS_EN_TRANSLATION_API_ENABLED !== 'true' || !process.env.OPENAI_API_KEY)
    throw Error('Translation API is disabled or unconfigured')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw Error(`Translation provider HTTP ${response.status}`)
  const data = await response.json()
  const saved = {
    id: data.id,
    status: data.status,
    output: data.output,
    usage: data.usage,
    model: data.model,
  }
  if (data.status !== 'completed' || !Array.isArray(data.output))
    throw new SavedTranslationResponseError(saved)
  const parts = data.output
    .flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
    .filter((part: { type: string }) => part.type === 'output_text')
  if (parts.length !== 1 || typeof parts[0].text !== 'string')
    throw new SavedTranslationResponseError(saved)
  try {
    return JSON.parse(parts[0].text)
  } catch {
    throw new SavedTranslationResponseError(saved)
  }
}
