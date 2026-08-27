import type { DefaultCellComponentProps } from 'payload'

export const MoneyCell = ({ cellData }: DefaultCellComponentProps) => {
  if (typeof cellData !== 'number' || !Number.isFinite(cellData)) {
    return <span>{typeof cellData === 'undefined' || cellData === null ? '' : String(cellData)}</span>
  }

  return <span>{cellData.toFixed(2)}</span>
}
