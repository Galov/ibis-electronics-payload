import { format } from 'date-fns'
import { bg } from 'date-fns/locale'

type Props = {
  date: string
  format?: string
}

export const formatDateTime = ({ date, format: formatFromProps }: Props): string => {
  if (!date) return ''

  const dateFormat = formatFromProps ?? 'dd.MM.yyyy'

  const formattedDate = format(new Date(date), dateFormat, { locale: bg })

  return formattedDate
}
