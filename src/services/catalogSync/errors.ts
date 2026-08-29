export class CatalogSyncError extends Error {
  code: string
  status?: number

  constructor(code: string, message: string, options?: { cause?: unknown; status?: number }) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = 'CatalogSyncError'
    this.code = code
    this.status = options?.status
  }
}
