import type { AccountProfile, MediaFormat, MediaItem } from './types'

/** Shapes returned by Meta's Graph API (Business Discovery). Also accepted by the JSON importer. */
export interface GraphMedia {
  id: string
  caption?: string
  comments_count?: number
  like_count?: number
  view_count?: number
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type?: 'FEED' | 'REELS' | 'AD' | 'STORY'
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  children?: { data?: { id: string }[] }
}

export interface GraphBusinessDiscovery {
  username?: string
  name?: string
  biography?: string
  website?: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  media?: { data?: GraphMedia[]; paging?: { cursors?: { after?: string } } }
}

export function normalizeProfile(bd: GraphBusinessDiscovery, fallbackUsername: string): AccountProfile {
  return {
    username: bd.username ?? fallbackUsername,
    name: bd.name ?? null,
    biography: bd.biography ?? null,
    website: bd.website ?? null,
    profilePictureUrl: bd.profile_picture_url ?? null,
    followersCount: numOrNull(bd.followers_count),
    followsCount: numOrNull(bd.follows_count),
    mediaCount: numOrNull(bd.media_count),
  }
}

export function normalizeMedia(m: GraphMedia): MediaItem | null {
  if (!m.id || !m.timestamp) return null
  if (m.media_product_type === 'STORY' || m.media_product_type === 'AD') return null
  let format: MediaFormat
  if (m.media_type === 'CAROUSEL_ALBUM') format = 'CAROUSEL'
  else if (m.media_type === 'VIDEO') format = m.media_product_type === 'REELS' ? 'REELS' : 'VIDEO'
  else format = 'IMAGE'
  return {
    id: m.id,
    permalink: m.permalink ?? null,
    timestamp: new Date(m.timestamp).toISOString(),
    format,
    caption: m.caption ?? null,
    likeCount: numOrNull(m.like_count),
    commentsCount: numOrNull(m.comments_count),
    viewCount: format === 'REELS' || format === 'VIDEO' ? numOrNull(m.view_count) : null,
    thumbnailUrl: (format === 'REELS' || format === 'VIDEO' ? m.thumbnail_url : m.media_url) ?? m.media_url ?? null,
    childrenCount: m.children?.data ? m.children.data.length : null,
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

