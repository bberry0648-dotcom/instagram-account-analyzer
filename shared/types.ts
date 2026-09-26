/**
 * Provider-neutral data model shared by the frontend and the serverless API.
 *
 * Every metric is `number | null`. `null` means "the source did not give us this value"
 * (hidden likes, no views on images, CSV column missing, ...). It must never be replaced
 * by a guessed or default number — analytics skip null metrics instead.
 */

export type MediaFormat = 'REELS' | 'VIDEO' | 'CAROUSEL' | 'IMAGE'

export interface AccountProfile {
  username: string
  name: string | null
  biography: string | null
  website: string | null
  profilePictureUrl: string | null
  followersCount: number | null
  followsCount: number | null
  mediaCount: number | null
}

export interface MediaItem {
  id: string
  permalink: string | null
  timestamp: string // ISO 8601
  format: MediaFormat
  caption: string | null
  likeCount: number | null
  commentsCount: number | null
  viewCount: number | null
  thumbnailUrl: string | null
  childrenCount: number | null
}

export type DataSourceKind = 'meta' | 'external' | 'imported'

export interface DataSourceInfo {
  kind: DataSourceKind
  /** Human-readable name, e.g. "Meta Instagram API (Business Discovery)" */
  label: string
  /** When the source data was fetched/exported (ISO). */
  fetchedAt: string
  /** Free-form notes about coverage, e.g. "pagination stopped at 500 posts". */
  notes: string[]
}

export interface AccountDataset {
  profile: AccountProfile
  /** Newest first. */
  media: MediaItem[]
  source: DataSourceInfo
  /** True when the provider reached the oldest available post (i.e. "all available"). */
  reachedEnd: boolean
}

export type ProviderErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND_OR_NOT_PROFESSIONAL'
  | 'PRIVATE_OR_RESTRICTED'
  | 'RATE_LIMITED'
  | 'ACCESS_CODE_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'NOT_CONFIGURED'
  | 'NO_POSTS'
  | 'NETWORK'
  | 'UPSTREAM'
  | 'UNKNOWN'

export interface ApiErrorBody {
  error: {
    code: ProviderErrorCode
    /** Safe, user-facing detail. Never contains tokens or raw upstream payloads. */
    detail?: string
  }
}
