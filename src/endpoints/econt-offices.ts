import type { PayloadHandler } from 'payload'

const ECONT_BASE_URL = process.env.ECONT_BASE_URL || 'https://ee.econt.com/services'

type EcontCity = {
  id?: number
  name?: string
  regionName?: string
  servingOffices?: Array<{
    officeCode?: string
    servingType?: string
  }>
}

type EcontOffice = {
  address?: {
    fullAddress?: string
    fullAddressEn?: string
  }
  code?: string
  id?: number
  isAPS?: boolean
  isMPS?: boolean
  name?: string
}

const jsonError = (message: string, status: number) =>
  Response.json(
    {
      message,
    },
    { status },
  )

let cachedCities: EcontCity[] | null = null
let cachedAllOffices:
  | Array<{
      address: string
      code: string
      id: string
      isAPS: boolean
      isMPS: boolean
      name: string
    }>
  | null = null

const getEcontCredentials = () => {
  const username = process.env.ECONT_USERNAME || ''
  const password = process.env.ECONT_PASSWORD || ''

  if (!username || !password) {
    throw new Error('Липсват ECONT_USERNAME и/или ECONT_PASSWORD за Econt.')
  }

  return { password, username }
}

const postEcont = async <T>({
  body,
  path,
}: {
  body: Record<string, unknown>
  path: string
}): Promise<T> => {
  const { password, username } = getEcontCredentials()
  const auth = Buffer.from(`${username}:${password}`).toString('base64')

  const response = await fetch(`${ECONT_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    method: 'POST',
  })

  const data = (await response.json()) as T & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message || `Econt request failed with status ${response.status}.`)
  }

  return data
}

const loadCities = async () => {
  if (cachedCities) return cachedCities

  const data = await postEcont<{
    cities?: EcontCity[]
  }>({
    body: {
      countryCode: 'BGR',
    },
    path: '/Nomenclatures/NomenclaturesService.getCities.json',
  })

  cachedCities = Array.isArray(data.cities) ? data.cities.filter((city) => city.id && city.name) : []
  return cachedCities
}

const getRegions = async () => {
  const cities = await loadCities()

  return Array.from(
    new Map(
      cities
        .filter((city) => city.regionName)
        .map((city) => [city.regionName!.toLowerCase(), { id: city.regionName!, name: city.regionName! }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
}

const getCitiesForRegion = async (region: string) => {
  const cities = await loadCities()

  return cities
    .filter((city) => city.regionName?.toLowerCase() === region.toLowerCase())
    .map((city) => ({
      id: String(city.id),
      name: city.name || '',
      region: city.regionName || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
}

const getOfficesForCity = async (cityId: string) => {
  const data = await postEcont<{
    offices?: EcontOffice[]
  }>({
    body: {
      cityID: Number(cityId),
      countryCode: 'BGR',
      servingReceptions: true,
    },
    path: '/Nomenclatures/NomenclaturesService.getOffices.json',
  })

  return (Array.isArray(data.offices) ? data.offices : [])
    .filter((office) => office.id && office.name)
    .map((office) => ({
      address: office.address?.fullAddress || office.address?.fullAddressEn || '',
      code: office.code || '',
      id: String(office.id),
      isAPS: Boolean(office.isAPS),
      isMPS: Boolean(office.isMPS),
      name: office.name || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
}

const getAllOffices = async () => {
  if (cachedAllOffices) return cachedAllOffices

  const data = await postEcont<{
    offices?: EcontOffice[]
  }>({
    body: {
      countryCode: 'BGR',
      servingReceptions: true,
    },
    path: '/Nomenclatures/NomenclaturesService.getOffices.json',
  })

  cachedAllOffices = (Array.isArray(data.offices) ? data.offices : [])
    .filter((office) => office.id && office.name)
    .map((office) => ({
      address: office.address?.fullAddress || office.address?.fullAddressEn || '',
      code: office.code || '',
      id: String(office.id),
      isAPS: Boolean(office.isAPS),
      isMPS: Boolean(office.isMPS),
      name: office.name || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  return cachedAllOffices
}

const getServingOfficesForCity = async (cityId: string) => {
  const cities = await loadCities()
  const city = cities.find((item) => String(item.id) === cityId)
  const officeCodes = (city?.servingOffices || [])
    .map((office) => office.officeCode?.trim())
    .filter(Boolean) as string[]

  if (officeCodes.length === 0) {
    return []
  }

  const allOffices = await getAllOffices()
  const allowedCodes = new Set(officeCodes)

  return allOffices.filter((office) => allowedCodes.has(office.code))
}

export const econtOfficesHandler: PayloadHandler = async (req) => {
  try {
    const requestURL = new URL(
      req.url || '/api/integrations/econt/offices',
      process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    )
    const level = requestURL.searchParams.get('level')

    if (level === 'regions') {
      return Response.json({ regions: await getRegions() }, { status: 200 })
    }

    if (level === 'cities') {
      const region = requestURL.searchParams.get('region')?.trim()

      if (!region) {
        return jsonError('Липсва избрана област.', 400)
      }

      return Response.json({ cities: await getCitiesForRegion(region) }, { status: 200 })
    }

    if (level === 'offices') {
      const cityId = requestURL.searchParams.get('cityId')?.trim()

      if (!cityId) {
        return jsonError('Липсва избрано населено място.', 400)
      }

      const directOffices = await getOfficesForCity(cityId)
      const offices = directOffices.length > 0 ? directOffices : await getServingOfficesForCity(cityId)

      return Response.json({ offices }, { status: 200 })
    }

    return jsonError('Невалидно ниво за справка.', 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Възникна проблем при заявката към Econt.'
    return jsonError(message, 500)
  }
}
