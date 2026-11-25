import { createHash } from 'node:crypto'
import { translationPaths, type SourceText } from '../../scripts/localization/translationCore'
import { englishHash, type EnglishText } from './transfer'
export const textHash = (value: string | null) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
/** Compact provenance: never duplicate product descriptions in the live baseline. */
export function translationState(
  productId: string,
  fingerprint: string,
  source: SourceText,
  english: EnglishText,
) {
  return {
    productId,
    fingerprint,
    sourceHashes: Object.fromEntries(
      translationPaths.map((path) => [path, textHash(source[path])]),
    ),
    englishHash: englishHash(english),
  }
}
