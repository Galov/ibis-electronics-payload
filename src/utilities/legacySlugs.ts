const hasReplacementCharacter = (value: string) => value.includes('\uFFFD')

const hasNonASCII = (value: string) => /[^\x00-\x7F]/.test(value)

const decodePercentEncodedSlug = (value: string): string | null => {
  if (!value.includes('%')) return null

  try {
    const decoded = decodeURIComponent(value)

    if (!decoded || hasReplacementCharacter(decoded)) return null

    return decoded
  } catch {
    return null
  }
}

const decodeHexByteSegment = (segment: string): string | null => {
  if (!/^[0-9a-f]+$/i.test(segment)) return null
  if (segment.length < 4 || segment.length % 2 !== 0) return null

  const bytes = segment.match(/.{2}/g)
  if (!bytes) return null

  const decoded = Buffer.from(bytes.map((byte) => Number.parseInt(byte, 16))).toString('utf8')

  if (!decoded || hasReplacementCharacter(decoded) || !hasNonASCII(decoded)) return null

  return decoded
}

const decodeCyrillicHexRuns = (segment: string): string | null => {
  let decodedAnyRun = false
  const decodedSegment = segment.replace(/((?:d0|d1)[0-9a-f]{2})+/gi, (match) => {
    const decoded = decodeHexByteSegment(match)

    if (!decoded) return match

    decodedAnyRun = true
    return decoded
  })

  return decodedAnyRun ? decodedSegment : null
}

export const decodeMangledLegacySlug = (value: string): string | null => {
  const decodedPercentSlug = decodePercentEncodedSlug(value)

  if (decodedPercentSlug) return decodedPercentSlug

  const segments = value.split('-')
  let decodedAnySegment = false

  const decodedSegments = segments.map((segment) => {
    const decodedSegment = decodeHexByteSegment(segment) || decodeCyrillicHexRuns(segment)

    if (!decodedSegment) return segment

    decodedAnySegment = true
    return decodedSegment
  })

  return decodedAnySegment ? decodedSegments.join('-') : null
}

export function ensureLegacySlug(value: string, fallback: string, sourceId: number): string {
  const candidate = decodeMangledLegacySlug(value || fallback) || value || fallback
  const normalized = candidate
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `legacy-${sourceId}`
}
