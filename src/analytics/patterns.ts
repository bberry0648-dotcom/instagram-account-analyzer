import { captionLengthBucket } from './classify'
import { binomialLowerTail, binomialUpperTail, mean, median, nonNull } from './stats'
import type { AnalyzedPost, Dimension, GroupStat, MonthStat, Overview, ViralLift } from './types'
import { FORMAT_LABEL, formatGroup } from './types'

export const MIN_GROUP = 3
export const STRONG_GROUP = 8

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

type Getter = (p: AnalyzedPost) => string | string[]

const DIMENSIONS: { id: Dimension['id']; label: string; get: Getter }[] = [
  { id: 'format', label: 'Format', get: (p) => FORMAT_LABEL[formatGroup(p.format)] },
  { id: 'contentType', label: 'Content Type (캡션 기반 추정)', get: (p) => p.features.contentType },
  { id: 'hook', label: 'Hook (캡션 첫 줄 기준)', get: (p) => p.features.hook },
  { id: 'captionStyle', label: 'Caption Style', get: (p) => p.features.captionStyle },
  { id: 'cta', label: 'CTA', get: (p) => (p.features.ctas.length ? p.features.ctas : ['없음']) },
  { id: 'captionLength', label: 'Caption Length', get: (p) => captionLengthBucket(p.features.captionLength) },
  { id: 'weekday', label: '게시 요일', get: (p) => `${WEEKDAYS[new Date(p.timestamp).getDay()]}요일` },
]

export function confidenceOf(n: number): GroupStat['confidence'] {
  return n >= STRONG_GROUP ? 'strong' : n >= MIN_GROUP ? 'weak' : 'insufficient'
}

export function buildDimensions(posts: AnalyzedPost[]): Dimension[] {
  return DIMENSIONS.map(({ id, label, get }) => {
    const groups = new Map<string, AnalyzedPost[]>()
    for (const p of posts) {
      const keys = get(p)
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k)!.push(p)
      }
    }
    const stats: GroupStat[] = [...groups.entries()].map(([key, list]) => groupStat(key, list, posts.length))
    stats.sort((a, b) => b.count - a.count)
    return { id, label, groups: stats }
  })
}

/** p-value cut-offs. Many groups are tested at once, so "strong" is deliberately strict. */
export const P_STRONG = 0.01
export const P_WEAK = 0.1

function groupStat(key: string, list: AnalyzedPost[], total: number): GroupStat {
  const perfs = list.map((p) => p.viral.performanceIndex).filter(nonNull)
  const above = perfs.filter((v) => v > 1).length
  return {
    aboveMedian: above,
    pBetter: binomialUpperTail(above, perfs.length, 0.5),
    pWorse: binomialLowerTail(above, perfs.length, 0.5),
    key,
    count: list.length,
    share: total ? list.length / total : 0,
    medianPerf: median(list.map((p) => p.viral.performanceIndex).filter(nonNull)),
    medianScore: median(list.map((p) => p.viral.score).filter(nonNull)),
    viralCount: list.filter((p) => p.viral.isViral).length,
    avgEngagementRate: mean(list.map((p) => p.engagementRate).filter(nonNull)),
    confidence: confidenceOf(list.length),
  }
}

/** Attributes over-represented among viral posts compared to all posts. */
export function buildViralLifts(posts: AnalyzedPost[]): ViralLift[] {
  const viral = posts.filter((p) => p.viral.isViral)
  if (viral.length < 2) return []
  const lifts: ViralLift[] = []
  for (const { label, get } of DIMENSIONS) {
    const all = new Map<string, number>()
    const vir = new Map<string, number>()
    for (const p of posts) for (const k of [get(p)].flat()) all.set(k, (all.get(k) ?? 0) + 1)
    for (const p of viral) for (const k of [get(p)].flat()) vir.set(k, (vir.get(k) ?? 0) + 1)
    for (const [value, vc] of vir) {
      const overallShare = (all.get(value) ?? 0) / posts.length
      const viralShare = vc / viral.length
      if (vc < 2 || overallShare === 0) continue
      const pValue = binomialUpperTail(vc, viral.length, overallShare)
      // Weekday splits are the easiest place to find coincidences — demand the strict bar there.
      if (pValue >= (label === '게시 요일' ? P_STRONG : P_WEAK)) continue
      lifts.push({
        dimension: label,
        value,
        viralCount: vc,
        viralTotal: viral.length,
        viralShare,
        overallShare,
        lift: viralShare / overallShare,
        pValue,
        confidence: pValue < P_STRONG && vc >= 3 ? 'strong' : 'weak',
      })
    }
  }
  return lifts.filter((l) => l.lift >= 1.25 && l.value !== '분류 불가').sort((a, b) => a.pValue - b.pValue)
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function buildMonths(posts: AnalyzedPost[]): MonthStat[] {
  const byMonth = new Map<string, AnalyzedPost[]>()
  for (const p of posts) {
    const d = new Date(p.timestamp)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(p)
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      const [y, m] = key.split('-').map(Number)
      const types = new Map<string, number>()
      for (const p of list) {
        if (p.features.contentType !== '분류 불가') types.set(p.features.contentType, (types.get(p.features.contentType) ?? 0) + 1)
      }
      const mainType = [...types.entries()].sort((a, b) => b[1] - a[1])[0]
      const top = [...list].sort((a, b) => (b.viral.score ?? -1) - (a.viral.score ?? -1))[0] ?? null
      return {
        key,
        label: `${MONTHS[m - 1]} ${y}`,
        count: list.length,
        avgEngagementRate: mean(list.map((p) => p.engagementRate).filter(nonNull)),
        medianPerf: median(list.map((p) => p.viral.performanceIndex).filter(nonNull)),
        viralCount: list.filter((p) => p.viral.isViral).length,
        topPost: top && top.viral.score !== null ? top : null,
        mainContentType: mainType ? mainType[0] : null,
        postIds: list.map((p) => p.id),
      }
    })
}

export function buildOverview(posts: AnalyzedPost[], selected: AnalyzedPost[]): Overview {
  const n = posts.length
  const share = (f: 'REELS' | 'CAROUSEL' | 'IMAGE') => (n ? posts.filter((p) => formatGroup(p.format) === f).length / n : 0)
  const videos = posts.filter((p) => p.format === 'REELS' || p.format === 'VIDEO')
  return {
    analyzedCount: n,
    selectedCount: selected.length,
    formatShare: { REELS: share('REELS'), CAROUSEL: share('CAROUSEL'), IMAGE: share('IMAGE') },
    avgEngagementRate: mean(posts.map((p) => p.engagementRate).filter(nonNull)),
    avgLikes: mean(posts.map((p) => p.likeCount).filter(nonNull)),
    avgComments: mean(posts.map((p) => p.commentsCount).filter(nonNull)),
    avgViews: mean(videos.map((p) => p.viewCount).filter(nonNull)),
    viralCount: posts.filter((p) => p.viral.isViral).length,
    likesHiddenCount: posts.filter((p) => p.likeCount === null).length,
    metricCoverage: {
      likes: posts.filter((p) => p.likeCount !== null).length,
      comments: posts.filter((p) => p.commentsCount !== null).length,
      views: videos.filter((p) => p.viewCount !== null).length,
      videos: videos.length,
    },
  }
}
