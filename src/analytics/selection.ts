import type { AnalyzedPost, Badge, SelectionReason } from './types'
import { formatGroup } from './types'

/**
 * Picks 10–20 representative posts from everything in the period, mixing criteria instead of
 * taking the newest 20:
 *
 *   1. Viral            up to 8   — isViral, highest Viral Score first
 *   2. High engagement  3–5       — highest engagement rate (or performance index without followers)
 *   3. Recent           3–5       — newest
 *   4. Representative   3–5       — the account's most common format × content type, closest to typical performance
 *   5. Format diversity           — every format used in the period gets at least one post
 *   6. Fill                       — if still under 10, highest Viral Score
 *
 * Each post appears once; badges record *every* criterion a post satisfies.
 */
export const SELECTION_CONFIG = {
  max: 20,
  min: 10,
  viralMax: 8,
  engagementMin: 3,
  engagementMax: 5,
  recentMin: 3,
  recentMax: 5,
  representativeMin: 3,
  representativeMax: 5,
  recentBadgeCount: 5,
  highEngagementTopShare: 0.2,
}

function engagementKey(p: AnalyzedPost): number {
  return p.engagementRate ?? p.viral.performanceIndex ?? -1
}

export function assignBadges(posts: AnalyzedPost[]): void {
  const byRecent = [...posts].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const recentIds = new Set(byRecent.slice(0, SELECTION_CONFIG.recentBadgeCount).map((p) => p.id))
  const ranked = posts.filter((p) => engagementKey(p) >= 0).sort((a, b) => engagementKey(b) - engagementKey(a))
  const topN = Math.max(1, Math.round(ranked.length * SELECTION_CONFIG.highEngagementTopShare))
  const highIds = new Set(
    ranked
      .slice(0, topN)
      // Top-20% must also be above the account's typical level to deserve the badge.
      .filter((p) => (p.viral.performanceIndex ?? 0) >= 1.2)
      .map((p) => p.id),
  )
  for (const p of posts) {
    const b: Badge[] = []
    if (p.viral.isViral) b.push('VIRAL')
    if (highIds.has(p.id)) b.push('HIGH ENGAGEMENT')
    if (recentIds.has(p.id)) b.push('RECENT')
    p.badges = b
  }
}

export function selectRepresentativePosts(posts: AnalyzedPost[]): AnalyzedPost[] {
  const cfg = SELECTION_CONFIG
  const chosen = new Map<string, SelectionReason>()
  const take = (list: AnalyzedPost[], n: number, reason: SelectionReason) => {
    let added = 0
    for (const p of list) {
      if (added >= n || chosen.size >= cfg.max) break
      if (chosen.has(p.id)) continue
      chosen.set(p.id, reason)
      added++
    }
  }
  const scoreOf = (p: AnalyzedPost) => p.viral.score ?? -1
  const small = posts.length <= cfg.max

  // 1. Viral
  take(
    posts.filter((p) => p.viral.isViral).sort((a, b) => scoreOf(b) - scoreOf(a)),
    cfg.viralMax,
    'viral',
  )
  // 2. High engagement
  take(
    posts.filter((p) => engagementKey(p) >= 0).sort((a, b) => engagementKey(b) - engagementKey(a)),
    small ? cfg.engagementMax : chosen.size >= 8 ? cfg.engagementMin : cfg.engagementMax,
    'engagement',
  )
  // 3. Recent
  take(
    [...posts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    chosen.size >= 12 ? cfg.recentMin : cfg.recentMax,
    'recent',
  )
  // 4. Representative: most common format × content type combos, typical performance first
  const comboCount = new Map<string, number>()
  const combo = (p: AnalyzedPost) => `${formatGroup(p.format)}|${p.features.contentType}`
  for (const p of posts) comboCount.set(combo(p), (comboCount.get(combo(p)) ?? 0) + 1)
  const representative = posts
    .filter((p) => (comboCount.get(combo(p)) ?? 0) >= 2)
    .sort((a, b) => {
      const c = (comboCount.get(combo(b)) ?? 0) - (comboCount.get(combo(a)) ?? 0)
      if (c !== 0) return c
      const typical = (p: AnalyzedPost) => Math.abs(Math.log(p.viral.performanceIndex ?? 1))
      return typical(a) - typical(b)
    })
  // Spread across combos: at most 2 per combo.
  const perCombo = new Map<string, number>()
  const spread = representative.filter((p) => {
    const k = combo(p)
    const n = perCombo.get(k) ?? 0
    if (n >= 2 || chosen.has(p.id)) return false
    perCombo.set(k, n + 1)
    return true
  })
  take(spread, chosen.size >= 15 ? cfg.representativeMin : cfg.representativeMax, 'representative')

  // 5. Format diversity
  const chosenFormats = new Set(posts.filter((p) => chosen.has(p.id)).map((p) => formatGroup(p.format)))
  for (const f of ['REELS', 'CAROUSEL', 'IMAGE'] as const) {
    if (chosenFormats.has(f)) continue
    const best = posts.filter((p) => formatGroup(p.format) === f).sort((a, b) => scoreOf(b) - scoreOf(a))[0]
    if (best) {
      if (chosen.size >= cfg.max) {
        // Make room by dropping the last non-viral pick.
        const drop = [...chosen.entries()].reverse().find(([, r]) => r !== 'viral')
        if (drop) chosen.delete(drop[0])
      }
      chosen.set(best.id, 'format')
    }
  }

  // 6. Fill up to the minimum
  if (chosen.size < Math.min(cfg.min, posts.length)) {
    take([...posts].sort((a, b) => scoreOf(b) - scoreOf(a)), Math.min(cfg.min, posts.length) - chosen.size, 'fill')
  }

  const out: AnalyzedPost[] = []
  for (const p of posts) {
    const reason = chosen.get(p.id)
    if (!reason) continue
    p.selectedFor = reason
    if (reason === 'representative' && !p.badges.includes('REPRESENTATIVE')) p.badges.push('REPRESENTATIVE')
    out.push(p)
  }
  return out
}
