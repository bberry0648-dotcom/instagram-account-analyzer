import { fmtRatio } from './viralScore'
import type { AnalyzedPost } from './types'
import { FORMAT_LABEL } from './types'

/** One-paragraph "biggest difference" between the best and worst of the compared posts. */
export function biggestDifference(posts: AnalyzedPost[]): string {
  if (posts.length < 2) return ''
  const scored = posts.filter((p) => p.viral.score !== null)
  if (scored.length < 2) return '두 게시물 모두 비교할 수 있는 지표가 부족합니다.'
  const sorted = [...scored].sort((a, b) => b.viral.score! - a.viral.score!)
  const hi = sorted[0]
  const lo = sorted[sorted.length - 1]
  const name = (p: AnalyzedPost) => `POST ${String.fromCharCode(65 + posts.indexOf(p))}`

  // Largest metric gap in either direction.
  const metricDiffs: { label: string; ratio: number; winner: AnalyzedPost; loser: AnalyzedPost }[] = []
  const add = (label: string, get: (p: AnalyzedPost) => number | null) => {
    const a = get(hi)
    const b = get(lo)
    if (a === null || b === null || a <= 0 || b <= 0) return
    metricDiffs.push(a >= b ? { label, ratio: a / b, winner: hi, loser: lo } : { label, ratio: b / a, winner: lo, loser: hi })
  }
  add('좋아요', (p) => p.likeCount)
  add('댓글', (p) => p.commentsCount)
  add('조회수', (p) => p.viewCount)
  metricDiffs.sort((a, b) => b.ratio - a.ratio)

  const attrs: string[] = []
  if (hi.format !== lo.format) attrs.push(`형식(${FORMAT_LABEL[hi.format]} vs ${FORMAT_LABEL[lo.format]})`)
  if (hi.features.contentType !== lo.features.contentType) attrs.push(`콘텐츠 유형(${hi.features.contentType} vs ${lo.features.contentType})`)
  if (hi.features.hook !== lo.features.hook) attrs.push(`첫 줄 훅(${hi.features.hook} vs ${lo.features.hook})`)
  if (hi.features.cta !== lo.features.cta) attrs.push(`CTA(${hi.features.cta} vs ${lo.features.cta})`)

  const parts: string[] = []
  const m = metricDiffs[0]
  if (m && m.ratio >= 1.5) {
    parts.push(`${name(m.winner)}가 ${name(m.loser)}보다 ${m.label}가 ${fmtRatio(m.ratio)}배 많습니다.`)
  } else {
    parts.push('두 게시물의 좋아요·댓글·조회수 차이는 1.5배 미만입니다.')
  }
  const gap = hi.viral.score! - lo.viral.score!
  parts.push(
    gap >= 8
      ? `계정 평균 대비 성과(Viral Score)는 ${name(hi)}가 ${gap}점 높습니다.`
      : `계정 평균 대비 성과(Viral Score)는 ${gap}점 차이로 비슷합니다.`,
  )
  parts.push(
    attrs.length
      ? `속성 차이는 ${attrs.slice(0, 3).join(', ')}입니다. 표본이 ${posts.length}개뿐이라 이 차이를 원인으로 단정할 수는 없습니다.`
      : '형식·유형·훅·CTA가 같아서, 캡션으로는 설명되지 않는 차이(영상 내용, 게시 시점 등)일 수 있습니다.',
  )
  return parts.join(' ')
}
