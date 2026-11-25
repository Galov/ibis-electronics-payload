import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'
const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(here, '../../..')
const env = {}
for (const name of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'SHELL'])
  if (process.env[name]) env[name] = process.env[name]
// Empty every project credential before Next can load its .env files.
for (const file of fs
  .readdirSync(root)
  .filter((name) => name.startsWith('.env') && fs.statSync(path.join(root, name)).isFile()))
  for (const name of Object.keys(dotenv.parse(fs.readFileSync(path.join(root, file)))))
    env[name] = ''
Object.assign(env, {
  DATABASE_URL:
    'mongodb://127.0.0.1:27028/ibis_en_release_rehearsal?replicaSet=ibisEnLocal&directConnection=true',
  PAYLOAD_SECRET: randomBytes(32).toString('hex'),
  IBIS_LOCAL_PREVIEW: 'true',
  IBIS_PRODUCT_LOCALIZATION_PREVIEW: 'true',
  IBIS_EN_RELEASE_REHEARSAL: 'true',
  IBIS_EN_TRANSLATION_QUEUE_ENABLED: 'false',
  IBIS_EN_TRANSLATION_API_ENABLED: 'false',
  MERCHANT_SYNC_ENABLED: 'false',
  CATALOG_SYNC_SEND_ENABLED: 'false',
  ARTICLE_SYNC_SEND_ENABLED: 'false',
  ROMANIA_UPDATES_SEND_ENABLED: 'false',
  NIK_ORDERS_SEND_ENABLED: 'false',
  NIK_SYNC_FORCE_DISABLED: 'true',
  NEXT_PUBLIC_SERVER_URL: 'http://127.0.0.1:3110',
  NEXT_PUBLIC_R2_PUBLIC_BASE_URL: 'https://pub-622233fdc4f2482dbbcdc30b088f61ab.r2.dev',
  NEXT_DIST_DIR: '.next-english-rehearsal',
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: `--import=${pathToFileURL(path.join(here, 'network-guard.mjs')).href}`,
  // This is a local simulator, never a Revolut sandbox or live account.
  REVOLUT_SECRET_KEY: 'local-rehearsal-dummy',
  REVOLUT_API_BASE_URL: 'http://127.0.0.1:3112/api',
})
if (process.argv.length > 2) throw Error('Rehearsal server accepts no arguments')
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3110'],
  { cwd: root, env, stdio: 'inherit' },
)
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 1))
