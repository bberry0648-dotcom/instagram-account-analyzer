import type { ApiErrorBody } from '../shared/types'
import { isValidUsername } from '../shared/username'
import { ExternalProvider, type ExternalEnv } from './providers/external'
import { MetaInstagramProvider, type MetaEnv } from './providers/meta'
import { ProviderError, type ServerProvider } from './providers/types'

export interface Env extends MetaEnv, ExternalEnv {
  /** Comma-separated list of allowed browser origins. */
  ALLOWED_ORIGINS?: string
}

export interface ResponseCache {
  get(key: string): Promise<Response | undefined>
  put(key: string, res: Response): Promise<void>
}

const CACHE_TTL_SECONDS = 15 * 60

/**
 * Runtime-agnostic request handler (Cloudflare Worker, Node dev server).
 *
 *   GET /api/health
 *   GET /api/account?username=nike&since=2026-03-26T00:00:00Z&provider=meta|external
 */
export async function handleRequest(req: Request, env: Env, cache?: ResponseCache): Promise<Response> {
  const url = new URL(req.url)
  const cors = corsHeaders(req, env)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'GET') return json({ error: { code: 'INVALID_INPUT' } }, 405, cors)

  const providers: Record<string, ServerProvider> = {
    meta: new MetaInstagramProvider(env),
    external: new ExternalProvider(env),
  }

  if (url.pathname === '/api/health') {
    return json(
      {
        ok: true,
        providers: Object.fromEntries(Object.entries(providers).map(([k, p]) => [k, p.isConfigured()])),
      },
      200,
      cors,
    )
  }

  if (url.pathname !== '/api/account') return json({ error: { code: 'INVALID_INPUT' } }, 404, cors)

  const username = (url.searchParams.get('username') ?? '').toLowerCase()
  if (!isValidUsername(username)) {
    return json({ error: { code: 'INVALID_INPUT', detail: 'username' } } satisfies ApiErrorBody, 400, cors)
  }
  const providerId = url.searchParams.get('provider') ?? 'meta'
  const provider = providers[providerId]
  if (!provider) return json({ error: { code: 'INVALID_INPUT', detail: 'provider' } }, 400, cors)

  const sinceRaw = url.searchParams.get('since')
  const since = sinceRaw ? new Date(sinceRaw) : null
  if (since && Number.isNaN(since.getTime())) {
    return json({ error: { code: 'INVALID_INPUT', detail: 'since' } }, 400, cors)
  }

  // Cache per account/provider/day-granular period to protect the Meta rate limit.
  const cacheKey = `https://cache.local/${providerId}/${username}/${since ? since.toISOString().slice(0, 10) : 'all'}`
  const cached = await cache?.get(cacheKey)
  if (cached) return withHeaders(cached, { ...cors, 'X-Cache': 'HIT' })

  try {
    const dataset = await provider.fetchAccount(username, { since })
    const res = json(dataset, 200, { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` })
    await cache?.put(cacheKey, res.clone())
    return withHeaders(res, { ...cors, 'X-Cache': 'MISS' })
  } catch (err) {
    if (err instanceof ProviderError) {
      // Internal message is logged server-side only; the client gets a code + safe detail.
      console.warn(`[${providerId}] ${username}: ${err.code} ${err.message}`)
      return json({ error: { code: err.code, detail: err.detail } } satisfies ApiErrorBody, err.status, cors)
    }
    console.error(`[${providerId}] ${username}: unexpected`, err)
    return json({ error: { code: 'UNKNOWN' } } satisfies ApiErrorBody, 500, cors)
  }
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

function withHeaders(res: Response, headers: Record<string, string>): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v)
  return out
}
