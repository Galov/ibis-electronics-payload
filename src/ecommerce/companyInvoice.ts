export type CompanyInvoice = {
  companyName: string
  companyId: string
  address: string
  vatNumber?: string | null
  representative?: string | null
}

export const companyInvoiceFields = [
  { name: 'companyName', label: 'Наименование на фирмата', required: true, maxLength: 200 },
  { name: 'companyId', label: 'ЕИК / БУЛСТАТ', required: true, maxLength: 13 },
  { name: 'address', label: 'Адрес за фактура', required: true, maxLength: 300 },
  { name: 'vatNumber', label: 'ДДС номер (ако има)', required: false, maxLength: 15 },
  { name: 'representative', label: 'МОЛ (по желание)', required: false, maxLength: 150 },
] as const

export const isCompleteCompanyInvoice = (invoice: CompanyInvoice) =>
  companyInvoiceFields.every(({ name, required, maxLength }) => {
    const value = invoice[name]?.trim()
    return value ? value.length <= maxLength : !required
  }) && /^(?:[0-9]{9}|[0-9]{13})$/.test(invoice.companyId.trim())

export const normalizeCompanyInvoice = (input: CompanyInvoice): CompanyInvoice => {
  if (
    !input ||
    typeof input !== 'object' ||
    companyInvoiceFields.some(({ name }) => {
      const value = input[name]
      return value != null && typeof value !== 'string'
    })
  ) {
    throw new Error('Невалидни данни за фирмена фактура.')
  }

  const invoice = {
    companyName: input.companyName?.trim() || '',
    companyId: input.companyId?.trim() || '',
    address: input.address?.trim() || '',
    vatNumber: input.vatNumber?.trim() || null,
    representative: input.representative?.trim() || null,
  }
  if (!isCompleteCompanyInvoice(invoice)) {
    throw new Error('Попълнете фирма, адрес и ЕИК / БУЛСТАТ от 9 или 13 цифри.')
  }
  return invoice
}
