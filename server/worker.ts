import { handleRequest, type Env } from './handler'

interface WorkerContext {
  waitUntil(p: Promise<unknown>): void
}

export default {
  async fetch(req: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    // Cloudflare's per-colo edge cache (`caches.default` exists only in the Workers runtime).
    const edgeCache = (caches as unknown as { default: Cache }).default
    return handleRequest(req, env, {
      get: async (key) => (await edgeCache.match(key)) ?? undefined,
      put: async (key, res) => ctx.waitUntil(edgeCache.put(key, res)),
    })
  },
}
