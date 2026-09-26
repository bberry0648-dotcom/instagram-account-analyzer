import type { MediaItem } from '../../shared/types'
import { clamp, median, nonNull, percentileBelow, rankFromTop } from './stats'

/**
 * Viral Score (0–100), normalised *within the account* so big and small accounts are comparable.
 *
 * For each metric the post actually has (likes, comments, views):
 *   ratio      = value / account median of that metric
 *   ratioScore = 50 + 25·log2(ratio), clamped 0–100   (median → 50, 2× → 75, 4× → 100, ½ → 25)
 *   component  = 0.6·ratioScore + 0.4·(percentile·100)
 * Score = weighted mean of available components (weights renormalised over what exists).
 *
 * - Metrics the source did not provide are skipped, never guessed.
 * - Views are compared only against other video posts.
 * - A metric is used only if ≥ MIN_BASELINE posts have it (otherwise "average" means nothing).
 * - Posts younger than MATURE_HOURS are still collecting reactions: they are left out of the
 *   baseline and their score is marked provisional.
 * - Engagement rate (÷ followers) equals the engagement ratio inside one account (same
 *   denominator), so it is reported but not double-weighted.
 */
export const VIRAL_CONFIG = {
  weights: { likes: 0.3, comments: 0.25, views: 0.45 },
  ratioWeight: 0.6,
  percentileWeight: 0.4,
  minBaseline: 5,
  matureHours: 72,
  viralMinScore: 70,
  viralMinRatio: 2,
  minPostsForViral: 8,
}

export type MetricKey = 'likes' | 'comments' | 'views'

export interface Baseline {
  medians: Record<MetricKey, number | null>
  samples: Record<MetricKey, number[]>
  matureCount: number
}

export interface MetricComponent {
  metric: MetricKey
  value: number
  median: number
  ratio: number
  percentile: number
  rank: number
  of: number
  score: number
}

export interface ViralResult {
  score: number | null
  components: MetricComponent[]
  isViral: boolean
  provisional: boolean
  reasons: string[]
  /** Geometric mean of available ratios — "how many × the account median". */
  performanceIndex: number | null
}

const LABEL: Record<MetricKey, string> = { likes: '좋아요', comments: '댓글', views: '조회수' }

function metricValue(m: MediaItem, k: MetricKey): number | null {
  if (k === 'likes') return m.likeCount
  if (k === 'comments') return m.commentsCount
  return m.format === 'REELS' || m.format === 'VIDEO' ? m.viewCount : null
}

export function ageHours(m: MediaItem, now: Date): number {
  return (now.getTime() - new Date(m.timestamp).getTime()) / 3_600_000
}

export function buildBaseline(posts: MediaItem[], now: Date = new Date()): Baseline {
  const mature = posts.filter((p) => ageHours(p, now) >= VIRAL_CONFIG.matureHours)
  // If almost everything is fresh (e.g. 1-month period on a new account) fall back to all posts.
  const pool = mature.length >= VIRAL_CONFIG.minBaseline ? mature : posts
  const samples = { likes: [], comments: [], views: [] } as Record<MetricKey, number[]>
  for (const p of pool) {
    for (const k of ['likes', 'comments', 'views'] as MetricKey[]) {
      const v = metricValue(p, k)
      if (nonNull(v)) samples[k].push(v)
    }
  }
  const medians = {} as Record<MetricKey, number | null>
  for (const k of ['likes', 'comments', 'views'] as MetricKey[]) {
    medians[k] = samples[k].length >= VIRAL_CONFIG.minBaseline ? median(samples[k]) : null
  }
  return { medians, samples, matureCount: pool.length }
}

export function calculateViralScore(
  post: MediaItem,
  baseline: Baseline,
  totalPosts: number,
  now: Date = new Date(),
): ViralResult {
  const components: MetricComponent[] = []
  for (const k of ['likes', 'comments', 'views'] as MetricKey[]) {
    const value = metricValue(post, k)
    const med = baseline.medians[k]
    if (!nonNull(value) || !nonNull(med)) continue
    // Median 0 (e.g. comments off) → use 1 to keep ratios finite.
    const ratio = value / Math.max(med, 1)
    const ratioScore = value === 0 ? 0 : clamp(50 + 25 * Math.log2(ratio), 0, 100)
    const pct = percentileBelow(value, baseline.samples[k])
    components.push({
      metric: k,
      value,
      median: med,
      ratio,
      percentile: pct,
      rank: rankFromTop(value, baseline.samples[k]),
      of: baseline.samples[k].length,
      score: VIRAL_CONFIG.ratioWeight * ratioScore + VIRAL_CONFIG.percentileWeight * pct * 100,
    })
  }

  const provisional = ageHours(post, now) < VIRAL_CONFIG.matureHours
  if (components.length === 0) {
    return { score: null, components, isViral: false, provisional, reasons: ['비교할 수 있는 지표가 부족합니다.'], performanceIndex: null }
  }

  const wSum = components.reduce((a, c) => a + VIRAL_CONFIG.weights[c.metric], 0)
  const score = Math.round(components.reduce((a, c) => a + c.score * VIRAL_CONFIG.weights[c.metric], 0) / wSum)
  const maxRatio = Math.max(...components.map((c) => c.ratio))
  const isViral =
    totalPosts >= VIRAL_CONFIG.minPostsForViral && score >= VIRAL_CONFIG.viralMinScore && maxRatio >= VIRAL_CONFIG.viralMinRatio
  const performanceIndex = Math.exp(
    components.reduce((a, c) => a + Math.log(Math.max(c.ratio, 0.05)), 0) / components.length,
  )

  return { score, components, isViral, provisional, reasons: explain(components, provisional, post, now), performanceIndex }
}

function explain(components: MetricComponent[], provisional: boolean, post: MediaItem, now: Date): string[] {
  const reasons: string[] = []
  const sorted = [...components].sort((a, b) => b.ratio - a.ratio)
  for (const c of sorted) {
    if (c.ratio >= 1.3) reasons.push(`계정 중앙값 대비 ${LABEL[c.metric]} ${fmtRatio(c.ratio)}배`)
  }
  for (const c of sorted) {
    const topPct = Math.max(1, Math.round((c.rank / c.of) * 100))
    if (c.of >= 10 && topPct <= 10) {
      reasons.push(`${LABEL[c.metric]} 상위 ${topPct}% (${c.of}개 중 ${c.rank}위)`)
    }
  }
  if (reasons.length === 0) {
    const best = sorted[0]
    reasons.push(`가장 높은 지표도 ${LABEL[best.metric]} 중앙값의 ${fmtRatio(best.ratio)}배 수준`)
  }
  if (provisional) {
    const days = Math.max(0, Math.floor(ageHours(post, now) / 24))
    reasons.push(`게시 ${days === 0 ? '당일' : `${days}일 차`} — 반응이 아직 쌓이는 중이라 점수가 바뀔 수 있음`)
  }
  return reasons
}

export function fmtRatio(r: number): string {
  return r >= 10 ? r.toFixed(0) : r.toFixed(1)
}
