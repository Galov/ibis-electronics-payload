// Local packaging only. No database, credentials, network, or deployment tools.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../.local-notes/english-products-review')
export async function prepareProtected() {
  const source = path.join(root, 'site')
  const output = path.join(root, 'cloudflare-protected')
  const stage = path.join(root, 'cloudflare-protected-staging')
  await fs.access(path.join(source, 'review-manifest.json'))
  await fs.rm(stage, { recursive: true, force: true })
  await fs.cp(source, stage, { recursive: true, dereference: false })
  await fs.copyFile(path.join(here, 'cloudflare/worker.mjs'), path.join(stage, '_worker.js'))
  await fs.writeFile(path.join(stage, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: [] }, null, 2) + '\n')
  await fs.rm(output, { recursive: true, force: true })
  await fs.rename(stage, output)
  console.log(`Protected review package prepared locally: ${output}`)
  return output
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw Error('This command accepts no arguments')
  await prepareProtected()
}
