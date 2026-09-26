import { handleRequest, type Env, type ResponseCache } from './handler'

interface WorkerContext {
  waitUntil(p: Promise<unknown>): void
}

/** Minimal Workers KV surface we use. */
interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

interface WorkerEnv extends Env {
  /** KV namespace binding (wrangler.toml). The Cache API is a no-op on *.workers.dev, KV is not. */
  CACHE?: KV
}

function kvCache(kv: KV, ctx: WorkerContext): ResponseCache {
  return {
    async get(key) {
      const body = await kv.get(key)
      return body ? new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }) : undefined
    },
    async put(key, res, ttl) {
      // KV requires expirationTtl ≥ 60 s.
      ctx.waitUntil(res.text().then((t) => kv.put(key, t, { expirationTtl: Math.max(60, ttl) })))
    },
  }
}

function edgeCache(ctx: WorkerContext): ResponseCache {
  // Cloudflare's per-colo cache (`caches.default` exists only in the Workers runtime; works on custom domains).
  const c = (caches as unknown as { default: Cache }).default
  return {
    get: async (key) => (await c.match(key)) ?? undefined,
    put: async (key, res) => ctx.waitUntil(c.put(key, res)),
  }
}

export default {
  async fetch(req: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
    return handleRequest(req, env, env.CACHE ? kvCache(env.CACHE, ctx) : edgeCache(ctx))
  },
}
