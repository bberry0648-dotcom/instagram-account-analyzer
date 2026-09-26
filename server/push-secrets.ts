/**
 * `npm run secrets:push` — copies secret values from ./.env to the Cloudflare Worker
 * (wrangler secret bulk) without printing them.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SECRET_KEYS = ['EXTERNAL_PROVIDER_KEY', 'ACCESS_CODE', 'META_ACCESS_TOKEN', 'META_IG_USER_ID']

if (!existsSync('.env')) {
  console.error('.env 파일이 없습니다.')
  process.exit(1)
}
const values: Record<string, string> = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && SECRET_KEYS.includes(m[1])) {
    const v = m[2].replace(/^["']|["']$/g, '')
    if (v) values[m[1]] = v
  }
}
const names = Object.keys(values)
if (names.length === 0) {
  console.error('.env에 올릴 비밀값이 없습니다 (EXTERNAL_PROVIDER_KEY 등).')
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'iaa-'))
const file = join(dir, 'secrets.json')
try {
  writeFileSync(file, JSON.stringify(values), { mode: 0o600 })
  const r = spawnSync('npx', ['wrangler', 'secret', 'bulk', file], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  // wrangler prints only names/status, but scrub values just in case.
  let out = `${r.stdout}\n${r.stderr}`
  for (const v of Object.values(values)) out = out.split(v).join('***')
  console.log(out.trim())
  console.log(`\n업로드 시도한 항목: ${names.join(', ')}`)
  process.exit(r.status ?? 1)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
