// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { englishTranslationQueueEnabled, englishTranslationTargetAllowed } from '@/translations/config'

describe('production English translation gate', () => {
  const release = {
    IBIS_PRODUCT_LOCALIZATION_ENABLED: 'true',
    IBIS_PRODUCT_LOCALIZATION_SCHEMA: 'bg-en-v1',
    IBIS_EN_TRANSLATION_QUEUE_ENABLED: 'true',
    IBIS_EN_TRANSLATION_API_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test-only',
    DATABASE_URL: 'mongodb+srv://user:secret@primary-cluster.qki0ar6.mongodb.net/IbisElectronicsPayload',
  }
  it('enables only the explicitly migrated Ibis production database with API credentials', () => {
    expect(englishTranslationQueueEnabled({})).toBe(false)
    expect(englishTranslationQueueEnabled(release)).toBe(true)
    expect(() => englishTranslationQueueEnabled({ ...release, OPENAI_API_KEY: '' })).toThrow('API key')
    for (const DATABASE_URL of [release.DATABASE_URL.replace('/IbisElectronicsPayload', '/other'), release.DATABASE_URL.replace('primary-cluster', 'other-cluster')])
      expect(englishTranslationTargetAllowed({ ...release, DATABASE_URL })).toBe(false)
    expect(() => englishTranslationQueueEnabled({ ...release, IBIS_LOCAL_PREVIEW: 'true' })).toThrow('preview')
  })
})
