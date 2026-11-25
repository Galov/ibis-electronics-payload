import { productLocalizationEnabled, localEnglishDatabaseNames } from '@/i18n/localProductLocalization'

export function englishTranslationTargetAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  const uri = new URL(env.DATABASE_URL || 'invalid:')
  if (env.IBIS_PRODUCT_LOCALIZATION_ENABLED === 'true')
    return (
      productLocalizationEnabled(env) &&
      uri.protocol === 'mongodb+srv:' &&
      uri.hostname === 'primary-cluster.qki0ar6.mongodb.net' &&
      uri.pathname === '/IbisElectronicsPayload'
    )
  return productLocalizationEnabled(env) && uri.hostname === '127.0.0.1' &&
    uri.port === '27028' && localEnglishDatabaseNames.some(name => uri.pathname === `/${name}`)
}

export function englishTranslationQueueEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.IBIS_EN_TRANSLATION_QUEUE_ENABLED !== 'true') return false
  if (!englishTranslationTargetAllowed(env)) throw Error('English translation requires an approved localized database')
  if (env.IBIS_EN_TRANSLATION_API_ENABLED === 'true' && !env.OPENAI_API_KEY?.startsWith('sk-'))
    throw Error('English translation API enabled without a configured API key')
  return true
}

export function assertEnglishTranslationDatabase(databaseName: string) {
  if (!englishTranslationTargetAllowed() || new URL(process.env.DATABASE_URL!).pathname !== `/${databaseName}`)
    throw Error('English translation database does not match the approved configuration')
}
