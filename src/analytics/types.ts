import type { AccountDataset, MediaFormat, MediaItem } from '../../shared/types'
import type { CaptionFeatures, CategoryEstimate } from './classify'
import type { Period } from './period'
import type { ViralResult } from './viralScore'

export type Badge = 'VIRAL' | 'HIGH ENGAGEMENT' | 'RECENT' | 'REPRESENTATIVE'
export type SelectionReason = 'viral' | 'engagement' | 'recent' | 'representative' | 'format' | 'fill'

export interface AnalyzedPost extends MediaItem {
  features: CaptionFeatures
  viral: ViralResult
  /** (likes + comments) / followers — null unless all three are known. */
  engagementRate: number | null
  /** likes + comments, null if likes are hidden/unknown. */
  engagementCount: number | null
  badges: Badge[]
  selectedFor: SelectionReason | null
}

export interface GroupStat {
  key: string
  count: number
  share: number
  /** Median performance index (× account median). */
  medianPerf: number | null
  medianScore: number | null
  viralCount: number
  avgEngagementRate: number | null
  confidence: 'strong' | 'weak' | 'insufficient'
  /** Posts in the group above the account median (performance index > 1). */
  aboveMedian: number
  /** Sign test vs 50/50: one-sided p for "better" and "worse" than typical. */
  pBetter: number
  pWorse: number
}

export interface Dimension {
  id: 'format' | 'contentType' | 'hook' | 'captionStyle' | 'cta' | 'captionLength' | 'weekday'
  label: string
  groups: GroupStat[]
}

export interface ViralLift {
  dimension: string
  value: string
  viralCount: number
  viralTotal: number
  viralShare: number
  overallShare: number
  lift: number
  /** Chance of seeing this many or more by luck (binomial tail). */
  pValue: number
  confidence: 'strong' | 'weak'
}

export interface MonthStat {
  key: string // YYYY-MM
  label: string // e.g. SEP 2026
  count: number
  avgEngagementRate: number | null
  medianPerf: number | null
  viralCount: number
  topPost: AnalyzedPost | null
  mainContentType: string | null
  postIds: string[]
}

export interface Overview {
  analyzedCount: number
  selectedCount: number
  formatShare: Record<'REELS' | 'CAROUSEL' | 'IMAGE', number>
  avgEngagementRate: number | null
  avgLikes: number | null
  avgComments: number | null
  avgViews: number | null
  viralCount: number
  likesHiddenCount: number
  metricCoverage: { likes: number; comments: number; views: number; videos: number }
}

export interface InsightItem {
  text: string
  evidence: string
  confidence: 'strong' | 'weak'
}

export interface Insights {
  working: InsightItem[]
  notWorking: InsightItem[]
  viralPattern: InsightItem[]
  opportunity: InsightItem[]
  ideas: { title: string; why: string }[]
  limitations: string[]
}

export interface AccountAnalysis {
  dataset: AccountDataset
  period: Period
  periodStart: Date | null
  periodEnd: Date
  analyzedAt: Date
  category: CategoryEstimate
  posts: AnalyzedPost[] // all posts in period, newest first
  selected: AnalyzedPost[] // representative set (≤ 20)
  overview: Overview
  dimensions: Dimension[]
  viralLifts: ViralLift[]
  months: MonthStat[]
  insights: Insights
  /** Whether the collected data covers the full requested period. */
  periodCoverage: { complete: boolean; oldestPost: string | null }
}

/** Formats grouped for ratios: VIDEO (non-reel video) counts with Reels. */
export function formatGroup(f: MediaFormat): 'REELS' | 'CAROUSEL' | 'IMAGE' {
  return f === 'VIDEO' ? 'REELS' : f
}

export const FORMAT_LABEL: Record<MediaFormat, string> = {
  REELS: 'Reels',
  VIDEO: 'Video',
  CAROUSEL: 'Carousel',
  IMAGE: 'Image',
}
