import type { AccountDataset, AccountProfile, MediaItem } from '../../shared/types'
import { normalizeMedia, normalizeProfile, type GraphBusinessDiscovery } from '../../shared/metaNormalize'
import { ProviderError, type FetchOptions, type ServerProvider } from './types'

/**
 * Meta Instagram API (Instagram API with Facebook Login) → Business Discovery.
 *
 * Reads public data of *another* Instagram Business/Creator account through the
 * app user's own professional account. Requires:
 *   META_ACCESS_TOKEN        long-lived token with instagram_basic, instagram_manage_insights,
 *                            pages_read_engagement (+ ads_read if the Page role comes via Business Manager)
 *   META_IG_USER_ID          the app user's own IG professional account id (1784...)
 *   META_GRAPH_VERSION       optional, default v25.0
 */
export interface MetaEnv {
  META_ACCESS_TOKEN?: string
  META_IG_USER_ID?: string
  META_GRAPH_VERSION?: string
  META_MAX_PAGES?: string
}

const PROFILE_FIELDS = 'username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count'
// Field tiers: if Meta rejects a field (API version drift), retry with a smaller set instead of failing.
const MEDIA_FIELD_TIERS = [
  'id,caption,comments_count,like_count,view_count,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id}',
  'id,caption,comments_count,like_count,view_count,media_type,media_product_type,media_url,permalink,timestamp',
  'id,caption,comments_count,like_count,media_type,media_url,permalink,timestamp',
]
const PAGE_SIZE = 50

interface GraphError {
  message?: string
  code?: number
  error_subcode?: number
  type?: string
}

export class MetaInstagramProvider implements ServerProvider {
  readonly id = 'meta'
  private readonly env: MetaEnv
  private readonly fetchImpl: typeof fetch

  constructor(env: MetaEnv, fetchImpl: typeof fetch = fetch) {
    this.env = env
    this.fetchImpl = fetchImpl
  }

  isConfigured(): boolean {
    return Boolean(this.env.META_ACCESS_TOKEN && this.env.META_IG_USER_ID)
  }

  async fetchAccount(username: string, opts: FetchOptions): Promise<AccountDataset> {
    if (!this.isConfigured()) {
      throw new ProviderError('NOT_CONFIGURED', 503, 'Meta Instagram API 자격 증명이 서버에 설정되지 않았습니다.')
    }
    const maxPages = clampInt(this.env.META_MAX_PAGES, 1, 40, 12)
    const notes: string[] = []
    let tier = 0
    let after: string | undefined
    let profile: AccountProfile | null = null
    const media: MediaItem[] = []
    let reachedEnd = false
    let page = 0

    while (page < maxPages) {
      let bd: GraphBusinessDiscovery
      try {
        bd = await this.request(username, MEDIA_FIELD_TIERS[tier], after)
      } catch (err) {
        // #100 = invalid field for this API version → downgrade the field set once per tier.
        if (err instanceof GraphCallError && err.graph.code === 100 && tier < MEDIA_FIELD_TIERS.length - 1 && page === 0) {
          tier++
          notes.push('일부 게시물 필드를 Meta API가 지원하지 않아 축소된 필드로 조회했습니다.')
          continue
        }
        throw toProviderError(err, username)
      }

      if (!profile) profile = normalizeProfile(bd, username)
      const items = bd.media?.data ?? []
      for (const m of items) {
        const item = normalizeMedia(m)
        if (item) media.push(item)
      }
      page++
      after = bd.media?.paging?.cursors?.after
      const oldest = media.at(-1)
      if (!after || items.length === 0) {
        reachedEnd = true
        break
      }
      if (opts.since && oldest && new Date(oldest.timestamp) < opts.since) break
    }
    if (!reachedEnd && page >= maxPages) {
      notes.push(`API 호출 한도를 아끼기 위해 최근 ${media.length}개 게시물까지만 조회했습니다.`)
    }
    if (tier > 0) notes.push('조회수(view_count) 등 일부 지표가 빠졌을 수 있습니다.')

    media.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return {
      profile: profile ?? normalizeProfile({}, username),
      media,
      reachedEnd,
      source: {
        kind: 'meta',
        label: 'Meta Instagram API (Business Discovery)',
        fetchedAt: new Date().toISOString(),
        notes,
      },
    }
  }

  private async request(username: string, mediaFields: string, after?: string): Promise<GraphBusinessDiscovery> {
    const version = this.env.META_GRAPH_VERSION || 'v25.0'
    const mediaEdge = `media${after ? `.after(${after})` : ''}.limit(${PAGE_SIZE}){${mediaFields}}`
    const fields = `business_discovery.username(${username}){${PROFILE_FIELDS},${mediaEdge}}`
    const url = new URL(`https://graph.facebook.com/${version}/${this.env.META_IG_USER_ID}`)
    url.searchParams.set('fields', fields)

    let res: Response
    try {
      // Token goes in the Authorization header so it never appears in URLs/logs.
      res = await this.fetchImpl(url.toString(), {
        headers: { Authorization: `Bearer ${this.env.META_ACCESS_TOKEN}` },
      })
    } catch {
      throw new ProviderError('NETWORK', 502, 'Meta API 서버에 연결하지 못했습니다.')
    }
    let body: { business_discovery?: GraphBusinessDiscovery; error?: GraphError }
    try {
      body = await res.json()
    } catch {
      throw new ProviderError('UPSTREAM', 502, 'Meta API 응답을 해석하지 못했습니다.')
    }
    if (!res.ok || body.error) throw new GraphCallError(body.error ?? { code: res.status })
    if (!body.business_discovery) {
      throw new ProviderError('NOT_FOUND_OR_NOT_PROFESSIONAL', 404)
    }
    return body.business_discovery
  }
}

class GraphCallError extends Error {
  readonly graph: GraphError
  constructor(graph: GraphError) {
    super(`Graph error ${graph.code}/${graph.error_subcode}: ${graph.message}`)
    this.graph = graph
  }
}

function toProviderError(err: unknown, username: string): ProviderError {
  if (err instanceof ProviderError) return err
  if (!(err instanceof GraphCallError)) return new ProviderError('UNKNOWN', 500, undefined, String(err))
  const { code, error_subcode: sub, message = '' } = err.graph
  if (code === 190 || code === 102 || code === 463 || code === 467) {
    return new ProviderError('TOKEN_EXPIRED', 503, undefined, message)
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || (code !== undefined && code >= 80001 && code <= 80014)) {
    return new ProviderError('RATE_LIMITED', 429, undefined, message)
  }
  // 110/2207013: "Cannot find User" — nonexistent, deleted, personal, private or age-gated.
  // Meta returns the same error for all of these, so we must not claim which one it is.
  if (code === 110 || sub === 2207013 || /cannot find user|invalid user id/i.test(message)) {
    return new ProviderError('NOT_FOUND_OR_NOT_PROFESSIONAL', 404, `@${username}`, message)
  }
  if (code === 10 || code === 200 || code === 3) {
    return new ProviderError('NOT_CONFIGURED', 503, 'Meta 앱 권한 설정을 확인해야 합니다.', message)
  }
  return new ProviderError('UPSTREAM', 502, undefined, message)
}

function clampInt(v: string | undefined, min: number, max: number, dflt: number): number {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}
