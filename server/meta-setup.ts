/**
 * One-time helper: `npm run meta:setup`
 *
 * Reads META_APP_ID, META_APP_SECRET, META_SHORT_TOKEN from ./.env, then
 *   1. exchanges the short-lived token for a long-lived one (~60 days)
 *   2. finds the Instagram professional account linked to your Facebook Page(s)
 *   3. writes META_ACCESS_TOKEN and META_IG_USER_ID back into .env and removes META_SHORT_TOKEN
 * Secrets are never printed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ENV_PATH = '.env'
const VERSION = 'v25.0'

function readEnv(): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(ENV_PATH)) return map
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) map.set(m[1], m[2].replace(/^["']|["']$/g, ''))
  }
  return map
}

function writeEnv(updates: Record<string, string | null>) {
  const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8').split('\n') : []
  const done = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1]
    if (key && key in updates) {
      done.add(key)
      if (updates[key] !== null) out.push(`${key}=${updates[key]}`)
    } else out.push(line)
  }
  for (const [k, v] of Object.entries(updates)) if (!done.has(k) && v !== null) out.push(`${k}=${v}`)
  writeFileSync(ENV_PATH, out.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 })
}

async function graph(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${VERSION}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url)
  const body = (await res.json()) as Record<string, unknown> & { error?: { message?: string; code?: number } }
  if (body.error) throw new Error(`Meta 오류 (code ${body.error.code}): ${body.error.message}`)
  return body
}

async function main() {
  const env = readEnv()
  const appId = env.get('META_APP_ID')
  const appSecret = env.get('META_APP_SECRET')
  const shortToken = env.get('META_SHORT_TOKEN')
  const missing = [
    ['META_APP_ID', appId],
    ['META_APP_SECRET', appSecret],
    ['META_SHORT_TOKEN', shortToken],
  ].filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) {
    console.error(`.env에 다음 값이 필요합니다: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log('1/3 장기 토큰으로 교환 중…')
  const exchanged = await graph('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId!,
    client_secret: appSecret!,
    fb_exchange_token: shortToken!,
  })
  const longToken = String(exchanged.access_token)
  const days = exchanged.expires_in ? Math.round(Number(exchanged.expires_in) / 86400) : null
  console.log(`   완료 (유효기간 약 ${days ?? '?'}일)`)

  console.log('2/3 페이지에 연결된 Instagram 계정 찾는 중…')
  const pages = (await graph('me/accounts', {
    fields: 'name,instagram_business_account{id,username}',
    access_token: longToken,
  })) as { data?: { name: string; instagram_business_account?: { id: string; username?: string } }[] }
  const linked = (pages.data ?? []).filter((p) => p.instagram_business_account)
  if (linked.length === 0) {
    console.error(
      '   Instagram 프로페셔널 계정이 연결된 Facebook 페이지를 찾지 못했습니다.\n' +
        '   - 토큰 권한에 pages_show_list, instagram_basic이 있는지\n' +
        '   - 로그인 때 해당 페이지를 선택(허용)했는지\n' +
        '   - Instagram 계정이 Business/Creator이고 페이지에 연결됐는지 확인해 주세요.',
    )
    process.exit(1)
  }
  for (const p of linked) console.log(`   페이지 "${p.name}" → @${p.instagram_business_account!.username}`)
  const ig = linked[0].instagram_business_account!

  console.log(`3/3 Business Discovery 권한 확인 중 (@${ig.username} 자신을 조회)…`)
  const test = (await graph(ig.id, {
    fields: `business_discovery.username(${ig.username}){followers_count,media_count}`,
    access_token: longToken,
  })) as { business_discovery?: { followers_count?: number; media_count?: number } }
  console.log(
    `   성공: 팔로워 ${test.business_discovery?.followers_count ?? '?'}명, 게시물 ${test.business_discovery?.media_count ?? '?'}개`,
  )

  writeEnv({ META_ACCESS_TOKEN: longToken, META_IG_USER_ID: ig.id, META_SHORT_TOKEN: null })
  console.log('\n.env에 META_ACCESS_TOKEN, META_IG_USER_ID를 저장했습니다. (토큰 값은 출력하지 않았습니다)')
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e))
  process.exit(1)
})
