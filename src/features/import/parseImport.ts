import type { AccountDataset, AccountProfile, MediaFormat, MediaItem } from '../../../shared/types'
import {
  normalizeMedia,
  normalizeProfile,
  type GraphBusinessDiscovery,
  type GraphMedia,
} from '../../../shared/metaNormalize'
import { isValidUsername } from '../../../shared/username'

export interface ImportProfileInput {
  username?: string
  followersCount?: number | null
}

export class ImportError extends Error {}

const FORMATS: MediaFormat[] = ['REELS', 'VIDEO', 'CAROUSEL', 'IMAGE']

/**
 * Supported inputs:
 *  - JSON (this app's format): { profile: AccountProfile, media: MediaItem[], exportedAt? }
 *  - JSON (Meta Graph API Explorer output): { business_discovery: {...} } or the inner object,
 *    or { data: GraphMedia[] } / GraphMedia[] (profile from the form)
 *  - CSV with a header row (see README for columns)
 * Nothing is inferred: a missing metric stays null.
 */
export function parseImport(
  text: string,
  fileName: string,
  fileModified: Date,
  profileInput: ImportProfileInput,
): AccountDataset {
  const isJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(text)
  const notes: string[] = [`파일: ${fileName}`]
  let profile: AccountProfile | null = null
  let media: MediaItem[]
  let fetchedAt = fileModified.toISOString()
  let label: string

  if (isJson) {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new ImportError('JSON 형식이 올바르지 않습니다.')
    }
    const parsed = parseJson(data, notes)
    profile = parsed.profile
    media = parsed.media
    if (parsed.exportedAt) fetchedAt = parsed.exportedAt
    label = parsed.graph ? 'Imported Data (Meta Graph API JSON)' : 'Imported Data (JSON)'
  } else {
    media = parseCsv(text, notes)
    label = 'Imported Data (CSV)'
  }

  const username = (profileInput.username || profile?.username || '').replace(/^@/, '').trim().toLowerCase()
  if (!isValidUsername(username)) {
    throw new ImportError('계정 username을 입력해 주세요. 파일에 계정 정보가 없습니다.')
  }
  const base: AccountProfile = profile ?? {
    username,
    name: null,
    biography: null,
    website: null,
    profilePictureUrl: null,
    followersCount: null,
    followsCount: null,
    mediaCount: null,
  }
  const finalProfile: AccountProfile = {
    ...base,
    username,
    followersCount: profileInput.followersCount ?? base.followersCount,
  }

  const seen = new Set<string>()
  media = media
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  if (media.length === 0) throw new ImportError('파일에서 읽을 수 있는 게시물이 없습니다.')

  return {
    profile: finalProfile,
    media,
    reachedEnd: true,
    source: { kind: 'imported', label, fetchedAt, notes },
  }
}

function parseJson(
  data: unknown,
  notes: string[],
): { profile: AccountProfile | null; media: MediaItem[]; exportedAt?: string; graph: boolean } {
  const obj = data as Record<string, unknown>

  // This app's own format
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj.profile && Array.isArray(obj.media)) {
    const p = obj.profile as Partial<AccountProfile>
    const media: MediaItem[] = []
    let skipped = 0
    for (const raw of obj.media as Partial<MediaItem>[]) {
      const m = validateNativeMedia(raw)
      if (m) media.push(m)
      else skipped++
    }
    if (skipped) notes.push(`형식이 맞지 않는 게시물 ${skipped}개는 제외했습니다.`)
    const exportedAt = typeof obj.exportedAt === 'string' && !Number.isNaN(Date.parse(obj.exportedAt)) ? obj.exportedAt : undefined
    return {
      profile: {
        username: String(p.username ?? ''),
        name: str(p.name),
        biography: str(p.biography),
        website: str(p.website),
        profilePictureUrl: str(p.profilePictureUrl),
        followersCount: num(p.followersCount),
        followsCount: num(p.followsCount),
        mediaCount: num(p.mediaCount),
      },
      media,
      exportedAt,
      graph: false,
    }
  }

  // Meta Graph API shapes
  let bd: GraphBusinessDiscovery | null = null
  if (obj && typeof obj === 'object' && 'business_discovery' in obj) bd = obj.business_discovery as GraphBusinessDiscovery
  else if (obj && typeof obj === 'object' && 'username' in obj && 'media' in obj) bd = obj as GraphBusinessDiscovery

  let graphMedia: GraphMedia[] | null = null
  if (bd) graphMedia = bd.media?.data ?? []
  else if (Array.isArray(data)) graphMedia = data as GraphMedia[]
  else if (obj && Array.isArray(obj.data)) graphMedia = obj.data as GraphMedia[]

  if (!graphMedia) throw new ImportError('지원하지 않는 JSON 구조입니다. README의 가져오기 형식을 확인해 주세요.')
  const media = graphMedia.map(normalizeMedia).filter((m): m is MediaItem => m !== null)
  const dropped = graphMedia.length - media.length
  if (dropped) notes.push(`id·timestamp가 없거나 스토리/광고인 항목 ${dropped}개는 제외했습니다.`)
  return { profile: bd ? normalizeProfile(bd, '') : null, media, graph: true }
}

function validateNativeMedia(raw: Partial<MediaItem>): MediaItem | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.timestamp !== 'string') return null
  const t = Date.parse(raw.timestamp)
  if (Number.isNaN(t)) return null
  const format = FORMATS.includes(raw.format as MediaFormat) ? (raw.format as MediaFormat) : null
  if (!format) return null
  return {
    id: raw.id,
    permalink: str(raw.permalink),
    timestamp: new Date(t).toISOString(),
    format,
    caption: str(raw.caption),
    likeCount: num(raw.likeCount),
    commentsCount: num(raw.commentsCount),
    viewCount: num(raw.viewCount),
    thumbnailUrl: str(raw.thumbnailUrl),
    childrenCount: num(raw.childrenCount),
  }
}

// ── CSV ────────────────────────────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  id: ['id', 'media_id', 'post_id', 'shortcode'],
  permalink: ['permalink', 'url', 'link', 'post_url'],
  timestamp: ['timestamp', 'date', 'posted_at', 'created_at', 'published_at', 'publish_time'],
  format: ['format', 'media_type', 'type', 'post_type'],
  productType: ['media_product_type', 'product_type'],
  caption: ['caption', 'text', 'description'],
  likes: ['like_count', 'likes'],
  comments: ['comments_count', 'comment_count', 'comments'],
  views: ['view_count', 'views', 'plays', 'video_views'],
  thumbnail: ['thumbnail_url', 'thumbnail', 'media_url', 'image_url'],
}

export function parseCsv(text: string, notes: string[]): MediaItem[] {
  const rows = splitCsv(text.replace(/^﻿/, ''))
  if (rows.length < 2) throw new ImportError('CSV에 머리글과 데이터 행이 필요합니다.')
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const col: Record<string, number> = {}
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h))
    if (idx >= 0) col[key] = idx
  }
  if (col.timestamp === undefined) throw new ImportError('CSV에 게시일(timestamp 또는 date) 열이 필요합니다.')
  if (col.likes === undefined && col.comments === undefined && col.views === undefined) {
    throw new ImportError('CSV에 like_count / comments_count / view_count 중 하나 이상의 열이 필요합니다.')
  }
  for (const [k, label] of [['likes', '좋아요'], ['comments', '댓글'], ['views', '조회수']] as const) {
    if (col[k] === undefined) notes.push(`CSV에 ${label} 열이 없어 해당 지표는 분석에서 제외됩니다.`)
  }

  const out: MediaItem[] = []
  let skipped = 0
  rows.slice(1).forEach((r, i) => {
    if (r.every((c) => c.trim() === '')) return
    const get = (k: string) => (col[k] !== undefined ? (r[col[k]] ?? '').trim() : '')
    const t = Date.parse(get('timestamp'))
    if (Number.isNaN(t)) {
      skipped++
      return
    }
    const permalink = get('permalink') || null
    const shortcode = permalink?.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/)?.[1]
    const format = csvFormat(get('format'), get('productType'))
    out.push({
      id: get('id') || shortcode || `row-${i + 2}`,
      permalink,
      timestamp: new Date(t).toISOString(),
      format,
      caption: get('caption') || null,
      likeCount: parseCount(get('likes')),
      commentsCount: parseCount(get('comments')),
      viewCount: format === 'REELS' || format === 'VIDEO' ? parseCount(get('views')) : null,
      thumbnailUrl: get('thumbnail') || null,
      childrenCount: null,
    })
  })
  if (skipped) notes.push(`게시일을 읽을 수 없는 행 ${skipped}개는 제외했습니다.`)
  return out
}

function csvFormat(v: string, product: string): MediaFormat {
  const s = v.toLowerCase()
  if (/reel/.test(s) || (/video/.test(s) && /reel/i.test(product))) return 'REELS'
  if (/video|clip|igtv/.test(s)) return 'VIDEO'
  if (/carousel|album|sidecar/.test(s)) return 'CAROUSEL'
  return 'IMAGE'
}

/** "1,234" → 1234, "1.2K" → 1200, "" → null. */
export function parseCount(v: string): number | null {
  const s = v.replace(/[,\s]/g, '')
  if (!s) return null
  const m = s.match(/^(\d+(?:\.\d+)?)([kKmM만]?)$/)
  if (!m) return null
  const n = Number.parseFloat(m[1])
  const mult = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, 만: 1e4, '': 1 }[m[2]] ?? 1
  return Math.round(n * mult)
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
