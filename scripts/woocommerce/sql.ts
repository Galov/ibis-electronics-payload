const INSERT_INTO_RE = /^INSERT INTO `([^`]+)` \((.+)\) VALUES\s*/s

export function parseInsertStatement(statement: string): { columns: string[]; rows: string[][]; table: string } | null {
  const match = statement.match(INSERT_INTO_RE)

  if (!match) return null

  const [, table, rawColumns] = match
  const valuesIndex = statement.indexOf('VALUES')

  if (valuesIndex < 0) return null

  const columns = rawColumns.split(',').map((column) => column.trim().replaceAll('`', ''))
  const values = statement.slice(valuesIndex + 'VALUES'.length).trim().replace(/;$/, '')

  return {
    columns,
    rows: parseTupleRows(values),
    table,
  }
}

function parseTupleRows(input: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inString = false
  let escapeNext = false
  let parenDepth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (escapeNext) {
      currentValue += char
      escapeNext = false
      continue
    }

    if (char === '\\') {
      currentValue += char
      escapeNext = true
      continue
    }

    if (char === "'") {
      inString = !inString
      currentValue += char
      continue
    }

    if (!inString) {
      if (char === '(') {
        parenDepth += 1
        if (parenDepth === 1) {
          currentRow = []
          currentValue = ''
          continue
        }
      }

      if (char === ')') {
        parenDepth -= 1
        if (parenDepth === 0) {
          currentRow.push(currentValue.trim())
          rows.push(currentRow)
          currentRow = []
          currentValue = ''
          continue
        }
      }

      if (char === ',' && parenDepth === 1) {
        currentRow.push(currentValue.trim())
        currentValue = ''
        continue
      }
    }

    if (parenDepth >= 1) currentValue += char
  }

  return rows
}

export function decodeSQLValue(value: string): string | null {
  if (value === 'NULL') return null

  if (value.startsWith("'") && value.endsWith("'")) {
    const inner = value.slice(1, -1)

    return inner
      .replaceAll("\\'", "'")
      .replaceAll('\\"', '"')
      .replaceAll('\\\\', '\\')
      .replaceAll('\\r', '\r')
      .replaceAll('\\n', '\n')
      .replaceAll('\\0', '\0')
      .replaceAll('\\Z', '\u001a')
  }

  return value
}
