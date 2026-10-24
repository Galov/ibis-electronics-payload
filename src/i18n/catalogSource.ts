import type { TypedFallbackLocale, TypedLocale } from 'payload'

// Transitional type bridge: generated types still declare locale: null until
// the separately rehearsed schema migration. Keep the runtime source language
// explicit now, without enabling localization against unmigrated documents.
// Remove the assertion after enabling BG/EN and regenerating Payload types.
export const catalogSourceLocale = {
  locale: 'bg',
  fallbackLocale: false,
} as unknown as { locale: TypedLocale; fallbackLocale: TypedFallbackLocale }
