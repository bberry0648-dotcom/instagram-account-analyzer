/**
 * Local API server for development: `npm run dev:api`.
 * Reads secrets from ./.env (never committed) and serves the same handler as the Worker.
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { handleRequest, type Env } from './handler'

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env: Env = { ...loadDotEnv('.env'), ...process.env } as Env
const port = Number(process.env.API_PORT ?? 8787)
const memory = new Map<string, { at: number; body: string; status: number; headers: [string, string][] }>()
const TTL = 15 * 60 * 1000

createServer(async (req, res) => {
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
  })
  const response = await handleRequest(request, env, {
    get: async (k) => {
      const hit = memory.get(k)
      if (!hit || Date.now() - hit.at > TTL) return undefined
      return new Response(hit.body, { status: hit.status, headers: hit.headers })
    },
    put: async (k, r) => {
      memory.set(k, { at: Date.now(), body: await r.text(), status: r.status, headers: [...r.headers] })
    },
  })
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(port, () => {
  const configured = Boolean(env.META_ACCESS_TOKEN && env.META_IG_USER_ID)
  console.log(`API on http://localhost:${port}  (Meta provider ${configured ? 'configured' : 'NOT configured'})`)
})
