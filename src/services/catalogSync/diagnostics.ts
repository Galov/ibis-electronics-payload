// CLI diagnostics intentionally omit stacks, request/response bodies and error data.
export const catalogSyncErrorDetails = (error: unknown) => {
  const secrets = Object.entries(process.env)
    .filter(([key, value]) => /secret|password|token|key|database_url/i.test(key) && value)
    .map(([, value]) => value as string)
    .sort((a, b) => b.length - a.length)
  const clean = (value: string) => {
    for (const secret of secrets) value = value.split(secret).join('[redacted]')
    return value
      .replace(/(?:https?|mongodb(?:\+srv)?):\/\/[^\s]+/gi, '[redacted URL]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/((?:password|token|secret|api[_-]?key)\s*[:=]\s*)\S+/gi, '$1[redacted]')
      .replace(/(["']).*?\1/g, '[redacted value]')
      .slice(0, 600)
  }
  const details: { name: string; message: string }[] = []
  const seen = new Set<unknown>()
  while (error instanceof Error && !seen.has(error) && details.length < 3) {
    seen.add(error)
    details.push({ name: clean(error.name), message: clean(error.message) })
    error = error.cause
  }
  return details
}
