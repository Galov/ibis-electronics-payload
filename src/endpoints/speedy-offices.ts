import type { PayloadHandler } from 'payload'

const SPEEDY_BASE_URL = 'https://api.speedy.bg/v1'

type SpeedyCountry = {
  id?: number
  isoAlpha2?: string
}

type SpeedySiteCsvRow = {
  id: string
  municipality: string
  name: string
  region: string
  type: string
}

type SpeedyOffice = {
  address?: {
    fullAddressString?: string
  }
  id?: number
  name?: string
  siteId?: number
}

const jsonError = (message: string, status: number) =>
  Response.json(
    {
      message,
    },
    { status },
  )

let cachedCountryId: number | null = null
let cachedSites: SpeedySiteCsvRow[] | null = null

const parseCsvLine = (line: string) =>
  line
    .split(',')
    .map((value) => value.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))

const getSpeedyCredentials = () => {
  const userName = process.env.SPEEDY_USERNAME || ''
  const password = process.env.SPEEDY_PASSWORD || ''

  if (!userName || !password) {
    throw new Error('Липсват SPEEDY_USERNAME и/или SPEEDY_PASSWORD за Speedy.')
  }

  return { password, userName }
}

const postSpeedy = async ({
  body,
  path,
}: {
  body: Record<string, unknown>
  path: string
}) => {
  const response = await fetch(`${SPEEDY_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Speedy request failed with status ${response.status}.`)
  }

  return response
}

const resolveCountryId = async () => {
  if (cachedCountryId) return cachedCountryId

  const { password, userName } = getSpeedyCredentials()
  const response = await postSpeedy({
    body: {
      isoAlpha2: 'BG',
      language: 'BG',
      password,
      userName,
    },
    path: '/location/country',
  })

  const data = (await response.json()) as {
    countries?: SpeedyCountry[]
    error?: { message?: string }
  }

  if (data.error?.message) throw new Error(data.error.message)

  const country = data.countries?.find((item) => item.isoAlpha2 === 'BG')

  if (!country?.id) {
    throw new Error('Не успяхме да открием Speedy country ID за България.')
  }

  cachedCountryId = country.id
  return country.id
}

const loadSites = async () => {
  if (cachedSites) return cachedSites

  const { password, userName } = getSpeedyCredentials()
  const countryId = await resolveCountryId()
  const response = await postSpeedy({
    body: {
      language: 'BG',
      password,
      userName,
    },
    path: `/location/site/csv/${countryId}`,
  })

  const csv = await response.text()
  cachedSites = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine)
    .filter((columns) => columns.length >= 10)
    .map((columns) => ({
      id: columns[0] || '',
      municipality: columns[7] || '',
      name: columns[5] || '',
      region: columns[9] || '',
      type: columns[3] || '',
    }))
    .filter((row) => row.id && row.name)

  return cachedSites
}

const getStates = async () => {
  const sites = await loadSites()

  return Array.from(
    new Map(
      sites
        .filter((site) => site.region)
        .map((site) => [site.region.toLowerCase(), { id: site.region, name: site.region }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
}

const getSitesForState = async (state: string) => {
  const sites = await loadSites()

  return Array.from(
    new Map(
      sites
        .filter((site) => site.region.toLowerCase() === state.toLowerCase())
        .map((site) => [
          site.id,
          {
            id: site.id,
            name: site.name,
            region: site.region,
          },
        ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
}

const getOfficesForSite = async (siteId: string) => {
  const { password, userName } = getSpeedyCredentials()
  const response = await postSpeedy({
    body: {
      language: 'BG',
      password,
      siteId: Number(siteId),
      userName,
    },
    path: '/location/office',
  })

  const data = (await response.json()) as {
    error?: { message?: string }
    offices?: SpeedyOffice[]
  }

  if (data.error?.message) throw new Error(data.error.message)

  return (Array.isArray(data.offices) ? data.offices : [])
    .filter((office) => office.id && office.name)
    .map((office) => ({
      address: office.address?.fullAddressString || '',
      id: String(office.id || ''),
      name: office.name || '',
      siteId: office.siteId ? String(office.siteId) : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
}

export const speedyOfficesHandler: PayloadHandler = async (req) => {
  try {
    const requestURL = new URL(
      req.url || '/api/integrations/speedy/offices',
      process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    )
    const level = requestURL.searchParams.get('level')

    if (level === 'states') {
      return Response.json({ states: await getStates() }, { status: 200 })
    }

    if (level === 'sites') {
      const state = requestURL.searchParams.get('state')?.trim()

      if (!state) {
        return jsonError('Липсва избрана област.', 400)
      }

      return Response.json({ sites: await getSitesForState(state) }, { status: 200 })
    }

    if (level === 'offices') {
      const siteId = requestURL.searchParams.get('siteId')?.trim()

      if (!siteId) {
        return jsonError('Липсва избран град.', 400)
      }

      return Response.json({ offices: await getOfficesForSite(siteId) }, { status: 200 })
    }

    return jsonError('Невалидно ниво за справка.', 400)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Възникна проблем при заявката към Speedy.'
    return jsonError(message, 500)
  }
}
