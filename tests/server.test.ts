import { describe, expect, it, vi } from 'vitest'
import { handleRequest } from '../server/handler'

const ENV = { META_ACCESS_TOKEN: 'SECRET_TOKEN', META_IG_USER_ID: '1784000', ALLOWED_ORIGINS: 'http://localhost:5173' }

function graphFetch(responses: unknown[]) {
  const calls: { url: string; auth: string | null }[] = []
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get('Authorization') })
    const body = responses.shift()
    return new Response(JSON.stringify(body), { status: (body as { error?: unknown }).error ? 400 : 200 })
  })
  return { impl, calls }
}

async function call(path: string, fetchImpl?: typeof fetch, env: Record<string, string> = ENV) {
  const orig = globalThis.fetch
  if (fetchImpl) globalThis.fetch = fetchImpl
  try {
    const res = await handleRequest(new Request(`http://api.test${path}`, { headers: { Origin: 'http://localhost:5173' } }), env)
    return { res, body: await res.json() }
  } finally {
    globalThis.fetch = orig
  }
}

describe('API handler', () => {
  it('rejects invalid usernames', async () => {
    const { res, body } = await call('/api/account?username=bad%20name')
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_INPUT')
  })

  it('reports NOT_CONFIGURED without secrets', async () => {
    const { res, body } = await call('/api/account?username=nike', undefined, {})
    expect(res.status).toBe(503)
    expect(body.error.code).toBe('NOT_CONFIGURED')
  })

  it('paginates business discovery and keeps the token out of the URL', async () => {
    const page = (ids: string[], after?: string, start = 20) => ({
      business_discovery: {
        username: 'nike',
        followers_count: 100,
        media: {
          data: ids.map((id, i) => ({ id, timestamp: `2026-09-${String(start - i).padStart(2, '0')}T00:00:00+0000`, media_type: 'IMAGE', like_count: 1, comments_count: 0 })),
          paging: after ? { cursors: { after } } : undefined,
        },
      },
    })
    const { impl, calls } = graphFetch([page(['1', '2'], 'CUR'), page(['3'], undefined, 10)])
    const { res, body } = await call('/api/account?username=nike', impl as unknown as typeof fetch)
    expect(res.status).toBe(200)
    expect(body.media.map((m: { id: string }) => m.id)).toEqual(['1', '2', '3'])
    expect(body.reachedEnd).toBe(true)
    expect(decodeURIComponent(calls[1].url)).toContain('.after(CUR)')
    expect(calls.every((c) => !c.url.includes('SECRET_TOKEN') && c.auth === 'Bearer SECRET_TOKEN')).toBe(true)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it.each([
    [{ code: 110, error_subcode: 2207013, message: 'Cannot find User' }, 'NOT_FOUND_OR_NOT_PROFESSIONAL', 404],
    [{ code: 190, message: 'Error validating access token: Session has expired' }, 'TOKEN_EXPIRED', 503],
    [{ code: 4, message: 'Application request limit reached' }, 'RATE_LIMITED', 429],
    [{ code: 1, message: 'weird' }, 'UPSTREAM', 502],
  ])('maps Graph error %o → %s without leaking the message', async (err, code, status) => {
    const { impl } = graphFetch([{ error: err }])
    const { res, body } = await call('/api/account?username=nike', impl as unknown as typeof fetch)
    expect(res.status).toBe(status)
    expect(body.error.code).toBe(code)
    expect(JSON.stringify(body)).not.toContain(err.message)
  })

  it('retries with fewer fields on #100', async () => {
    const { impl, calls } = graphFetch([
      { error: { code: 100, message: 'Tried accessing nonexisting field (view_count)' } },
      { business_discovery: { username: 'nike', media: { data: [] } } },
    ])
    const { res, body } = await call('/api/account?username=nike', impl as unknown as typeof fetch)
    expect(res.status).toBe(200)
    expect(decodeURIComponent(calls[1].url)).not.toContain('children')
    expect(body.source.notes.length).toBeGreaterThan(0)
  })
})
