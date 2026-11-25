/** Approved customer flat rates. Ibis absorbs toll, weight/volume differences.
 * Source checked 2026-11-25: https://services.speedy.bg/pricelist/
 * No temporary discounts. Romania is handled by the Romanian storefront.
 */
export const internationalDestinations = {
  GR: { name: 'Greece', fee: 7.42 },
  CY: { name: 'Cyprus', fee: 21.54 },
  HU: { name: 'Hungary', fee: 10.67 },
  CZ: { name: 'Czechia', fee: 10.67 },
  HR: { name: 'Croatia', fee: 10.67 },
  SI: { name: 'Slovenia', fee: 10.67 },
  SK: { name: 'Slovakia', fee: 10.67 },
  PL: { name: 'Poland', fee: 10.67 },
  AT: { name: 'Austria', fee: 23.99 },
  DE: { name: 'Germany', fee: 23.99 },
  BE: { name: 'Belgium', fee: 33.11 },
  FR: { name: 'France', fee: 33.11 },
  IT: { name: 'Italy', fee: 33.11 },
  NL: { name: 'Netherlands', fee: 33.11 },
  DK: { name: 'Denmark', fee: 46.78 },
  LU: { name: 'Luxembourg', fee: 46.78 },
  ES: { name: 'Spain', fee: 42.95 },
  EE: { name: 'Estonia', fee: 65.93 },
  FI: { name: 'Finland', fee: 65.93 },
  LV: { name: 'Latvia', fee: 65.93 },
  LT: { name: 'Lithuania', fee: 65.93 },
  PT: { name: 'Portugal', fee: 65.93 },
  SE: { name: 'Sweden', fee: 65.93 },
} as const
export type InternationalCountry = keyof typeof internationalDestinations
export function isInternationalCountry(value: string): value is InternationalCountry {
  return Object.prototype.hasOwnProperty.call(internationalDestinations, value)
}
// Unserved destinations plus surcharge areas require an individual enquiry.
// https://www.speedy.bg/bg/islands-surcharge (2026-11-25)
const excluded: Partial<Record<InternationalCountry, string>> = {
  DE: '18565,25846-25847,25849,25859,25863,25869,25929-25933,25938-25942,25946-25949,25952-25955,25961-25970,25980,25985-25986,25988-25990,25992-25994,25996-25999,26465,26474,26486,26548,26571,26579,26757,27498,83209,83256',
  DK: '3900-3999,3700,3720,3730,3740,3751,3760,3770,3782,3790,4592,5960,5970,5985,6720,7884,8305,8592,9940,9950,9960',
  ES: '35000-35999,38000-38999,51000-52999',
  IT: '47031,47890-47899,25050,30010,30012,30100-30126,30131-30133,30135,30141,04020,04027,57030-57039,58012,58019,07024,07046,71040,80070-80071,80073-80077,80079,90010,09014,91017,91023,92010,98050,98052,98055',
  FI: '22100,22101,22120,22130,22131,22140,22150,22151,22160,22220,22240,22260,22270,22271,22310,22320,22330,22340,22410,22411,22430,22520,22530,22540,22550,22610,22630,22710,22720,22730,22810,22820,22830,22840,22910,22920,22930,22940,22950,22999',
  FR: '00001-00030,00100-00151,00153-00299,00361-00429,00500-00699,00750-00999,96000-97999,98100-98999,17111,17123,17190,17310,17370,17410,17480,17550,17580,17590,17630,17670,17740,17880,17940,20000-20999,22870,26780,29242,29253,29259,56360,56590,56780,56840,85330,85350',
  EE: '62601,88001-88005,91217,91301-91320,92001-92420,93001-94799,96028,96098',
  NL: '1156AA-1156ZZ,1791AA-1797ZZ,8881AA-8884ZZ,8891AA-8897ZZ,8899AA-8899ZZ,9161AA-9164ZZ,9166AA-9166ZZ',
  SE: '10005,13000-13099,37020-37023,37025-37029,37042-37043,38060-38099,38500-38599,38700-38799,43080-43099,47100-47499,62000-62999,76019',
}
export function internationalPostalIssue(
  country: InternationalCountry,
  postal: unknown,
): 'invalid' | 'enquiry' | null {
  const code = typeof postal === 'string' ? postal.toUpperCase().replace(/\s/g, '') : ''
  const pattern =
    country === 'NL'
      ? /^\d{4}[A-Z]{2}$/
      : ['AT', 'BE', 'CY', 'DK', 'HU', 'LU', 'SI'].includes(country)
        ? /^\d{4}$/
        : country === 'PT'
          ? /^\d{4}-\d{3}$/
          : country === 'LV'
            ? /^(?:LV-)?\d{4}$/
            : country === 'LT'
              ? /^(?:LT-)?\d{5}$/
              : country === 'PL'
                ? /^\d{2}-?\d{3}$/
                : /^\d{5}$/
  if (!pattern.test(code)) return 'invalid'
  // Prefixes for the Baltic states do not affect numeric comparisons.
  const comparable = code.replace(/^(?:LV|LT)-/, '').replace('-', '')
  if (
    (excluded[country] || '').split(',').some((range) => {
      if (!range) return false
      const [start, end = start] = range.split('-')
      return comparable >= start && comparable <= end
    })
  )
    return 'enquiry'
  return null
}
