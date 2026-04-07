const blockTagPattern = /<\/?(div|p|section|article|ul|ol|li|table|tr|td|th|h[1-6])\b[^>]*>/gi
const lineBreakPattern = /<br\s*\/?>/gi
const anyTagPattern = /<[^>]+>/g

const decodeHtmlEntities = (value: string) => {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

export const formatLegacyProductDescription = (value?: null | string) => {
  if (!value) return ''

  return decodeHtmlEntities(
    value
      .replace(/\r/g, '\n')
      .replace(lineBreakPattern, '\n')
      .replace(blockTagPattern, '\n')
      .replace(anyTagPattern, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  )
}
