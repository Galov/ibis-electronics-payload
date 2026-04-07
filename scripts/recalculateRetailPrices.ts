import 'dotenv/config'

import { recalculateRetailPrices } from '../src/utilities/recalculateRetailPrices'

const result = await recalculateRetailPrices()
console.log(JSON.stringify(result, null, 2))
