import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const merchantActivityDirectory = '/tmp/ibis-merchant-active'

export async function withMerchantJobActivity<T>(jobID: string, run: () => Promise<T>): Promise<T> {
  // Production workers run on Linux. Local macOS development has no /proc filesystem.
  if (process.platform !== 'linux') return run()
  if (!/^[a-zA-Z0-9_-]+$/.test(jobID)) throw new Error('Invalid Merchant job ID')
  await mkdir(merchantActivityDirectory, { recursive: true, mode: 0o700 })
  const marker = path.join(merchantActivityDirectory, jobID + '.json')
  // Field 22 distinguishes the worker from a later process that reuses its PID.
  const stat = await readFile('/proc/self/stat', 'utf8')
  const startTime = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]
  await writeFile(marker, JSON.stringify({ pid: process.pid, startTime }), { mode: 0o600 })
  try {
    return await run()
  } finally {
    await unlink(marker).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') console.error('Merchant activity marker cleanup failed', error.code)
    })
  }
}
