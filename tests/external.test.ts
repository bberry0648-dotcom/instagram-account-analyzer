import { describe, expect, it, vi } from 'vitest'
import { handleRequest } from '../server/handler'

const ENV = { EXTERNAL_PROVIDER_NAME: 'apify', EXTERNAL_PROVIDER_KEY: 'APIFY_SECRET', EXTERNAL_MAX_POSTS: '50' }

// Shapes follow Apify's documented output; values are test fixtures only.
const PROFILE = [{ username: 'Brand', fullName: 'Brand Inc', biography: 'bio', followersCount: 1000, followsCount: 5, postsCount: 3, private: false }]
const POSTS = [
  { id: '1', shortCode: 'A', url: 'https://www.instagram.com/p/A/', type: 'Video', productType: 'clips', likesCount: 50, commentsCount: 2, videoPlayCount: 900, videoViewCount: 400, timestamp: '2026-09-01T00:00:00.000Z', displayUrl: 'https://cdn/x.jpg', ownerUsername: 'brand' },
  { id: '2', shortCode: 'B', type: 'Sidecar', likesCount: -1, commentsCount: 4, timestamp: '2026-08-01T00:00:00.000Z', childPosts: [{}, {}], ownerUsername: 'brand' },
  { id: '3', shortCode: 'C', type: 'Image', likesCount: 10, commentsCount: 0, timestamp: '2026-07-01T00:00:00.000Z', ownerUsername: 'someoneelse' },
]

function mockApify(profile: unknown, posts: unknown, status = 200) {
  const calls: { url: string; body: unknown; auth: string | null }[] = []
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get('Authorization') })
    if (status !== 200) return new Response('{}', { status })
    return new Response(JSON.stringify(url.includes('profile') ? profile : posts))
  }) as unknown as typeof fetch
  return calls
}

async function get(path: string, env: Record<string, string> = ENV, headers: Record<string, string> = {}) {
  const res = await handleRequest(new Request(`http://api.test${path}`, { headers }), env)
  return { res, body: await res.json() }
}

describe('external provider (Apify)', () => {
  it('maps posts, keeps hidden likes null, drops other owners, never leaks the key', async () => {
    const calls = mockApify(PROFILE, POSTS)
    const { res, body } = await get('/api/account?username=brand&provider=external&since=2026-08-15T00:00:00Z')
    expect(res.status).toBe(200)
    expect(body.profile).toMatchObject({ username: 'brand', followersCount: 1000 })
    expect(body.media).toHaveLength(2)
    expect(body.media[0]).toMatchObject({ format: 'REELS', viewCount: 900, likeCount: 50 })
    expect(body.media[1]).toMatchObject({ format: 'CAROUSEL', likeCount: null, childrenCount: 2 })
    expect(body.source.kind).toBe('external')
    const postCall = calls.find((c) => c.url.includes('post-scraper'))!
    // Always one 12-month window regardless of the requested period (one paid run per account).
    expect((postCall.body as { onlyPostsNewerThan: string }).onlyPostsNewerThan).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((postCall.body as { resultsLimit: number }).resultsLimit).toBe(50)
    expect(calls.every((c) => c.auth === 'Bearer APIFY_SECRET' && !c.url.includes('APIFY_SECRET'))).toBe(true)
    expect(JSON.stringify(body)).not.toContain('APIFY_SECRET')
  })

  it('reports private and missing accounts', async () => {
    mockApify([{ ...PROFILE[0], private: true }], [])
    expect((await get('/api/account?username=brand&provider=external')).body.error.code).toBe('PRIVATE_OR_RESTRICTED')
    mockApify([{ error: 'not_found', errorDescription: 'nope' }], [])
    expect((await get('/api/account?username=brand&provider=external')).body.error.code).toBe('NOT_FOUND_OR_NOT_PROFESSIONAL')
  })

  it('maps out-of-credit and bad key', async () => {
    mockApify(null, null, 402)
    const r = await get('/api/account?username=brand&provider=external')
    expect(r.body.error.code).toBe('RATE_LIMITED')
    expect(r.body.error.detail).toContain('크레딧')
    mockApify(null, null, 401)
    expect((await get('/api/account?username=brand&provider=external')).body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('requires the access code when configured', async () => {
    mockApify(PROFILE, POSTS)
    const env = { ...ENV, ACCESS_CODE: 'open-sesame' }
    expect((await get('/api/account?username=brand&provider=external', env)).res.status).toBe(401)
    expect((await get('/api/account?username=brand&provider=external', env, { 'X-Access-Code': 'wrong' })).res.status).toBe(401)
    expect((await get('/api/account?username=brand&provider=external', env, { 'X-Access-Code': 'open-sesame' })).res.status).toBe(200)
    const health = await get('/api/health', env)
    expect(health.body).toMatchObject({ accessCodeRequired: true, providers: { external: true } })
  })
})
