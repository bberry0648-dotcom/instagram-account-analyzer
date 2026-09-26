import type { AccountDataset, AccountProfile, MediaFormat, MediaItem } from '../../shared/types'
import { ProviderError, type FetchOptions } from './types'

/**
 * Apify adapter (actors `apify/instagram-profile-scraper` + `apify/instagram-post-scraper`).
 *
 * Third-party data: Apify collects public Instagram pages itself. Billing is per result
 * (~$2.3–2.7 / 1,000), so the number of posts per analysis is capped by EXTERNAL_MAX_POSTS.
 */
export interface ApifyOptions {
  token: string
  maxPosts: number
  fetchImpl: typeof fetch
}

interface ApifyProfile {
  username?: string
  fullName?: string
  biography?: string
  externalUrl?: string
  profilePicUrl?: string
  profilePicUrlHD?: string
  followersCount?: number
  followsCount?: number
  postsCount?: number
  private?: boolean
  error?: string
  errorDescription?: string
}

interface ApifyPost {
  id?: string
  shortCode?: string
  url?: string
  type?: 'Image' | 'Video' | 'Sidecar' | string
  productType?: string
  caption?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
  displayUrl?: string
  timestamp?: string
  childPosts?: unknown[]
  ownerUsername?: string
  error?: string
}

const BASE = 'https://api.apify.com/v2/acts'

export async function fetchFromApify(username: string, opts: FetchOptions, o: ApifyOptions): Promise<AccountDataset> {
  const postInput: Record<string, unknown> = {
    username: [username],
    resultsLimit: o.maxPosts,
    skipPinnedPosts: false,
  }
  if (opts.since) postInput.onlyPostsNewerThan = opts.since.toISOString().slice(0, 10)

  const [profiles, posts] = await Promise.all([
    runActor<ApifyProfile>('apify~instagram-profile-scraper', { usernames: [username] }, o),
    runActor<ApifyPost>('apify~instagram-post-scraper', postInput, o),
  ])

  const p = profiles.find((x) => !x.error && x.username)
  if (!p) throw new ProviderError('NOT_FOUND_OR_NOT_PROFESSIONAL', 404, `@${username}`, profiles[0]?.errorDescription)
  if (p.private) throw new ProviderError('PRIVATE_OR_RESTRICTED', 403, `@${username}`)

  const media = posts
    .filter((x) => !x.error && (!x.ownerUsername || x.ownerUsername.toLowerCase() === username))
    .map(normalizePost)
    .filter((m): m is MediaItem => m !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  // Pinned posts can be older than the period; the analytics filter them by date anyway.

  const hitCap = posts.length >= o.maxPosts
  const notes = ['외부 데이터 서비스(Apify)가 공개 페이지에서 수집한 데이터입니다. Meta 공식 API 수치와 약간 다를 수 있습니다.']
  if (hitCap) notes.push(`비용 제한으로 최근 게시물 ${o.maxPosts}개까지만 수집했습니다.`)
  if (media.some((m) => m.likeCount === null)) notes.push('일부 게시물은 좋아요 수가 숨겨져 있습니다.')

  const profile: AccountProfile = {
    username: (p.username ?? username).toLowerCase(),
    name: p.fullName || null,
    biography: p.biography || null,
    website: p.externalUrl || null,
    profilePictureUrl: p.profilePicUrlHD || p.profilePicUrl || null,
    followersCount: num(p.followersCount),
    followsCount: num(p.followsCount),
    mediaCount: num(p.postsCount),
  }
  return {
    profile,
    media,
    reachedEnd: !hitCap && !opts.since,
    source: { kind: 'external', label: 'External Provider (Apify)', fetchedAt: new Date().toISOString(), notes },
  }
}

async function runActor<T>(actor: string, input: unknown, o: ApifyOptions): Promise<T[]> {
  let res: Response
  try {
    res = await o.fetchImpl(`${BASE}/${actor}/run-sync-get-dataset-items?timeout=240`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new ProviderError('NETWORK', 502, '외부 데이터 서비스에 연결하지 못했습니다.')
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('TOKEN_EXPIRED', 503, undefined, `apify ${res.status}`)
  if (res.status === 402) {
    throw new ProviderError('RATE_LIMITED', 429, '외부 데이터 서비스의 사용 한도(크레딧)를 모두 썼습니다.', 'apify 402')
  }
  if (res.status === 429) throw new ProviderError('RATE_LIMITED', 429, undefined, 'apify 429')
  if (res.status === 408) throw new ProviderError('UPSTREAM', 504, '데이터 수집 시간이 너무 오래 걸려 중단됐습니다. 기간을 줄여 다시 시도해 주세요.')
  if (!res.ok) throw new ProviderError('UPSTREAM', 502, undefined, `apify ${res.status}`)
  const body = await res.json().catch(() => null)
  if (!Array.isArray(body)) throw new ProviderError('UPSTREAM', 502, undefined, 'apify non-array')
  return body as T[]
}

function normalizePost(x: ApifyPost): MediaItem | null {
  const id = x.id ?? x.shortCode
  if (!id || !x.timestamp || Number.isNaN(Date.parse(x.timestamp))) return null
  let format: MediaFormat
  if (x.type === 'Sidecar') format = 'CAROUSEL'
  else if (x.type === 'Video') format = x.productType === 'clips' || x.productType === 'reels' ? 'REELS' : 'VIDEO'
  else format = 'IMAGE'
  const isVideo = format === 'REELS' || format === 'VIDEO'
  return {
    id: String(id),
    permalink: x.url ?? (x.shortCode ? `https://www.instagram.com/p/${x.shortCode}/` : null),
    timestamp: new Date(x.timestamp).toISOString(),
    format,
    caption: x.caption || null,
    // Apify reports hidden likes as -1.
    likeCount: typeof x.likesCount === 'number' && x.likesCount >= 0 ? x.likesCount : null,
    commentsCount: typeof x.commentsCount === 'number' && x.commentsCount >= 0 ? x.commentsCount : null,
    // Instagram's public "views" for Reels are plays; fall back to the older view counter.
    viewCount: isVideo ? (num(x.videoPlayCount) ?? num(x.videoViewCount)) : null,
    thumbnailUrl: x.displayUrl ?? null,
    childrenCount: Array.isArray(x.childPosts) && x.childPosts.length ? x.childPosts.length : null,
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}
