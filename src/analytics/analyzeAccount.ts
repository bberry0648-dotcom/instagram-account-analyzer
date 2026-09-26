import type { AccountDataset } from '../../shared/types'
import { classifyCaption, estimateCategory } from './classify'
import { buildInsights } from './insights'
import { buildDimensions, buildMonths, buildOverview, buildViralLifts } from './patterns'
import { periodSince, type Period } from './period'
import { assignBadges, selectRepresentativePosts } from './selection'
import type { AccountAnalysis, AnalyzedPost } from './types'
import { buildBaseline, calculateViralScore } from './viralScore'

/** Pure function: dataset + period → full analysis. Never invents values. */
export function analyzeAccount(dataset: AccountDataset, period: Period, now: Date = new Date()): AccountAnalysis {
  const since = periodSince(period, now)
  const inPeriod = dataset.media.filter((m) => !since || new Date(m.timestamp) >= since)
  const followers = dataset.profile.followersCount

  const baseline = buildBaseline(inPeriod, now)
  const posts: AnalyzedPost[] = inPeriod.map((m) => {
    const engagementCount = m.likeCount !== null ? m.likeCount + (m.commentsCount ?? 0) : null
    return {
      ...m,
      features: classifyCaption(m.caption),
      viral: calculateViralScore(m, baseline, inPeriod.length, now),
      engagementCount,
      engagementRate:
        followers && m.likeCount !== null && m.commentsCount !== null ? (m.likeCount + m.commentsCount) / followers : null,
      badges: [],
      selectedFor: null,
    }
  })

  assignBadges(posts)
  const selected = selectRepresentativePosts(posts)
  const overview = buildOverview(posts, selected)
  const dimensions = buildDimensions(posts)
  const viralLifts = buildViralLifts(posts)
  const oldest = dataset.media.at(-1)?.timestamp ?? null

  return {
    dataset,
    period,
    periodStart: since,
    periodEnd: now,
    analyzedAt: now,
    category: estimateCategory(dataset.profile.biography, inPeriod.map((m) => m.caption)),
    posts,
    selected,
    overview,
    dimensions,
    viralLifts,
    months: buildMonths(posts),
    insights: buildInsights(posts, dimensions, viralLifts, overview),
    periodCoverage: {
      // Complete if the source reached the account's first post, or its oldest post predates the period.
      complete: dataset.reachedEnd || (since !== null && oldest !== null && new Date(oldest) <= since),
      oldestPost: oldest,
    },
  }
}
