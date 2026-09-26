import { describe, expect, it } from 'vitest'
import { analyzeAccount } from '../src/analytics/analyzeAccount'
import { buildBaseline, calculateViralScore } from '../src/analytics/viralScore'
import { classifyCaption } from '../src/analytics/classify'
import { biggestDifference } from '../src/analytics/compare'
import { dataset, post } from './helpers'

const NOW = new Date('2026-09-26T12:00:00Z')

describe('calculateViralScore', () => {
  const posts = Array.from({ length: 20 }, (_, i) => post(i, { format: 'REELS', viewCount: 1000 + i }))
  const base = buildBaseline(posts, NOW)

  it('gives ~50 to a median post', () => {
    const r = calculateViralScore(post(99, { format: 'REELS', likeCount: 100, commentsCount: 10, viewCount: 1010 }), base, 20, NOW)
    expect(r.score).toBeGreaterThan(35)
    expect(r.score).toBeLessThan(65)
    expect(r.isViral).toBe(false)
  })

  it('flags a 3× post as viral and explains it', () => {
    const r = calculateViralScore(post(99, { format: 'REELS', likeCount: 300, commentsCount: 34, viewCount: 5000 }), base, 20, NOW)
    expect(r.score).toBeGreaterThanOrEqual(70)
    expect(r.isViral).toBe(true)
    expect(r.reasons.join(' ')).toContain('좋아요 3.0배')
  })

  it('skips metrics that are missing instead of treating them as 0', () => {
    const r = calculateViralScore(post(99, { format: 'IMAGE', likeCount: null, commentsCount: 30 }), base, 20, NOW)
    expect(r.components.map((c) => c.metric)).toEqual(['comments'])
    expect(r.score).not.toBeNull()
  })

  it('returns null score when no metric is comparable', () => {
    const r = calculateViralScore(post(99, { likeCount: null, commentsCount: null, viewCount: null }), base, 20, NOW)
    expect(r.score).toBeNull()
  })

  it('marks fresh posts provisional', () => {
    const fresh = post(0, { timestamp: new Date(NOW.getTime() - 3_600_000).toISOString() })
    expect(calculateViralScore(fresh, base, 20, NOW).provisional).toBe(true)
  })

  it('never calls anything viral with fewer than 8 posts', () => {
    const few = Array.from({ length: 6 }, (_, i) => post(i))
    const b = buildBaseline(few, NOW)
    expect(calculateViralScore(post(9, { likeCount: 10_000 }), b, 6, NOW).isViral).toBe(false)
  })
})

describe('analyzeAccount / selection', () => {
  const media = Array.from({ length: 60 }, (_, i) =>
    post(i, i % 11 === 0 ? { likeCount: 500, commentsCount: 60, viewCount: i % 3 === 0 ? 9000 : null } : {}, NOW),
  )
  const a = analyzeAccount(dataset(media), '6m', NOW)

  it('selects 10–20 unique posts with mixed reasons and all formats', () => {
    expect(a.selected.length).toBeGreaterThanOrEqual(10)
    expect(a.selected.length).toBeLessThanOrEqual(20)
    expect(new Set(a.selected.map((p) => p.id)).size).toBe(a.selected.length)
    const reasons = new Set(a.selected.map((p) => p.selectedFor))
    expect(reasons.has('viral')).toBe(true)
    expect(reasons.has('recent')).toBe(true)
    expect(new Set(a.selected.map((p) => p.format)).size).toBe(3)
  })

  it('counts viral posts and computes format shares from data only', () => {
    expect(a.overview.viralCount).toBeGreaterThan(0)
    const s = a.overview.formatShare
    expect(s.REELS + s.CAROUSEL + s.IMAGE).toBeCloseTo(1)
  })

  it('respects the period filter', () => {
    const one = analyzeAccount(dataset(media), '1m', NOW)
    expect(one.posts.every((p) => new Date(p.timestamp) >= one.periodStart!)).toBe(true)
    expect(one.posts.length).toBeLessThan(a.posts.length)
  })

  it('leaves engagement rate null when followers are unknown', () => {
    const b = analyzeAccount(dataset(media, null), '6m', NOW)
    expect(b.posts.every((p) => p.engagementRate === null)).toBe(true)
    expect(b.overview.avgEngagementRate).toBeNull()
  })

  it('builds months and insights with evidence', () => {
    expect(a.months.length).toBeGreaterThan(0)
    for (const i of [...a.insights.working, ...a.insights.viralPattern]) expect(i.evidence).toMatch(/\d/)
    expect(a.insights.ideas.length).toBeGreaterThan(0)
  })

  it('handles empty periods without inventing data', () => {
    const e = analyzeAccount(dataset([]), '6m', NOW)
    expect(e.posts).toEqual([])
    expect(e.selected).toEqual([])
    expect(e.overview.avgLikes).toBeNull()
  })

  it('biggestDifference names the higher post', () => {
    const [x, y] = [a.posts.find((p) => p.viral.isViral)!, a.posts.find((p) => !p.viral.isViral)!]
    expect(biggestDifference([y, x])).toMatch(/POST B가 [0-9]+점 높습니다/)
  })
})

describe('classifyCaption', () => {
  it('detects hooks, CTA, content type', () => {
    const f = classifyCaption('신제품을 고르는 3가지 방법?\n1. 가격\n2. 소재\n3. 핏\n저장해 두세요 #tip')
    expect(f.hook).toBe('질문형')
    expect(f.captionStyle).toBe('정보형')
    expect(f.ctas).toContain('저장 유도')
    expect(f.hashtagCount).toBe(1)
  })
  it('handles null caption', () => {
    expect(classifyCaption(null).contentType).toBe('분류 불가')
  })
})

import { binomialUpperTail } from '../src/analytics/stats'
describe('significance', () => {
  it('binomial tail', () => {
    expect(binomialUpperTail(0, 10, 0.3)).toBe(1)
    expect(binomialUpperTail(10, 10, 0.5)).toBeCloseTo(1 / 1024)
    // 4 of 14 viral posts on a weekday that holds 12% of posts is plausible luck
    expect(binomialUpperTail(4, 14, 0.12)).toBeGreaterThan(0.05)
  })
  it('does not report patterns in pure noise', () => {
    // identical performance everywhere except random-ish viral posts spread evenly across groups
    const media = Array.from({ length: 60 }, (_, i) => post(i, i % 6 === 0 ? { likeCount: 400, commentsCount: 40 } : {}, NOW))
    const r = analyzeAccount(dataset(media), '6m', NOW)
    expect(r.viralLifts.filter((l) => l.confidence === 'strong' && l.dimension === '게시 요일')).toEqual([])
  })
})
