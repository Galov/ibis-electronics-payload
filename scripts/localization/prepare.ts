import { readFile, writeFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { planLocalization, rehearseLocalization, type Snapshot } from './plan'

const [input, output, ...extra] = process.argv.slice(2)
if (!input || !output || extra.length) {
  throw new Error('Usage: pnpm exec tsx scripts/localization/prepare.ts snapshot.json plan.json')
}
const snapshot = JSON.parse(await readFile(input, 'utf8')) as Snapshot
const plan = planLocalization(snapshot)
const forward = rehearseLocalization(snapshot, plan)
const restored = rehearseLocalization(forward, plan, true)
if (!isDeepStrictEqual(restored, snapshot)) throw new Error('Rollback rehearsal failed')
// Exclusive creation prevents replacing an earlier backup or review artifact.
await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
console.log(JSON.stringify({ patches: plan.patches.length, rollback: 'passed', databaseWrites: 0 }))
