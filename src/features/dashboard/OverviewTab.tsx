import { useState } from 'react'
import type { AccountAnalysis } from '../../analytics/types'
import { formatGroup } from '../../analytics/types'
import { FormatShareBar, GroupPerformanceChart, MonthlyCharts, PostPerformanceChart, ScoreDistributionChart } from '../../components/charts'
import { PostCard } from '../../components/PostCard'
import { Section, Stat, Tag } from '../../components/ui'
import { fmtNum, fmtPct } from '../../lib/format'
import { fmtRatio, VIRAL_CONFIG } from '../../analytics/viralScore'

export function OverviewTab({ a, onOpenTab }: { a: AccountAnalysis; onOpenTab: (t: string) => void }) {
  const o = a.overview
  const counts: Record<string, number> = { REELS: 0, CAROUSEL: 0, IMAGE: 0 }
  for (const p of a.posts) counts[formatGroup(p.format)]++
  const fmtDim = a.dimensions.find((d) => d.id === 'format')!

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="분석 게시물" value={`${o.analyzedCount}개`} sub={`대표 게시물 ${o.selectedCount}개 선별`} />
        <Stat label="Viral Posts" value={`${o.viralCount}개`} sub={o.analyzedCount >= 8 ? 'Score ≥ 70 & 지표 2배↑' : '8개 미만이라 판정 안 함'} />
        <Stat label="평균 Engagement" value={fmtPct(o.avgEngagementRate, 2)} sub={o.avgEngagementRate === null ? '팔로워 수 필요' : '(좋아요+댓글)÷팔로워'} />
        <Stat label="평균 Likes" value={fmtNum(o.avgLikes)} sub={o.likesHiddenCount ? `숨김 ${o.likesHiddenCount}개 제외` : undefined} />
        <Stat label="평균 Comments" value={fmtNum(o.avgComments)} />
        <Stat
          label="평균 Views"
          value={fmtNum(o.avgViews)}
          sub={o.metricCoverage.videos ? `영상 ${o.metricCoverage.views}/${o.metricCoverage.videos}개 기준` : '영상 없음'}
        />
        <Stat label="Reels 비율" value={fmtPct(o.formatShare.REELS, 0)} sub={`${counts.REELS}개`} />
        <Stat label="Carousel 비율" value={fmtPct(o.formatShare.CAROUSEL, 0)} sub={`${counts.CAROUSEL}개`} />
        <Stat label="Image 비율" value={fmtPct(o.formatShare.IMAGE, 0)} sub={`${counts.IMAGE}개`} />
        <Stat
          label="최고 Viral Score"
          value={Math.max(...a.posts.map((p) => p.viral.score ?? -1)) >= 0 ? Math.max(...a.posts.map((p) => p.viral.score ?? -1)) : '—'}
          sub="/ 100"
        />
      </div>

      <Section
        title="Post Performance"
        description="게시물별 Viral Score (오래된 순). 파란 막대가 바이럴 게시물이고, 막대에 올리면 상세 수치가 보입니다."
      >
        <PostPerformanceChart posts={a.posts} threshold={VIRAL_CONFIG.viralMinScore} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Reels vs Carousel vs Image" description="형식별 비중과 성과지수 중앙값">
          <FormatShareBar share={o.formatShare} counts={counts} />
          <div className="mt-4">
            <GroupPerformanceChart dim={fmtDim} colorByFormat />
          </div>
        </Section>
        <Section title="Engagement Distribution" description="Viral Score 분포 — 70점 이상(파랑)이 바이럴 후보 구간">
          <ScoreDistributionChart posts={a.posts} />
        </Section>
      </div>

      <MonthlySection a={a} />

      <Section
        title="대표 게시물 미리보기"
        action={
          <button type="button" onClick={() => onOpenTab('posts')} className="text-xs font-medium text-accent-text hover:underline">
            전체 {a.selected.length}개 보기
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {[...a.selected]
            .sort((x, y) => (y.viral.score ?? -1) - (x.viral.score ?? -1))
            .slice(0, 4)
            .map((p) => (
              <PostCard key={p.id} post={p} showReasons={false} />
            ))}
        </div>
      </Section>
    </div>
  )
}

function MonthlySection({ a }: { a: AccountAnalysis }) {
  const [active, setActive] = useState<string | null>(null)
  const month = a.months.find((m) => m.key === active) ?? null
  const posts = month ? a.posts.filter((p) => month.postIds.includes(p.id)).sort((x, y) => (y.viral.score ?? -1) - (x.viral.score ?? -1)) : []

  return (
    <Section title="Monthly Performance" description="월을 누르면 그 달의 게시물과 Top Post를 볼 수 있습니다.">
      <div className="scrollbar-none -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
        {a.months.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setActive(active === m.key ? null : m.key)}
            aria-pressed={active === m.key}
            className={
              'shrink-0 rounded-md border px-3 py-1.5 text-left text-xs transition-colors ' +
              (active === m.key ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-ink-2 hover:bg-surface-2')
            }
          >
            <div className="font-semibold">{m.label.slice(0, 3)}</div>
            <div className="tabular text-[10px] opacity-70">{m.label.slice(4)} · {m.count}개</div>
          </button>
        ))}
      </div>
      <MonthlyCharts months={a.months} activeKey={active} onSelect={(k) => setActive(k === active ? null : k)} />
      {month && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            <Stat label="게시물 수" value={`${month.count}개`} />
            <Stat label="평균 Engagement" value={fmtPct(month.avgEngagementRate, 2)} sub={month.medianPerf !== null ? `성과지수 ${fmtRatio(month.medianPerf)}×` : undefined} />
            <Stat label="Viral Post" value={`${month.viralCount}개`} />
            <Stat label="주요 콘텐츠 유형" value={<span className="text-base">{month.mainContentType ?? '—'}</span>} sub="캡션 기반 추정" />
          </div>
          <div className="mt-3 mb-2 flex items-center gap-2 text-xs text-ink-3">
            {month.label} 게시물 <Tag>Score 순</Tag>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {posts.slice(0, 8).map((p, i) => (
              <div key={p.id} className="relative">
                {i === 0 && month.topPost && (
                  <span className="absolute -top-2 left-2 z-10 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-bg">TOP POST</span>
                )}
                <PostCard post={p} showReasons={false} />
              </div>
            ))}
          </div>
          {posts.length > 8 && <p className="mt-2 text-xs text-ink-3">외 {posts.length - 8}개 — Posts 탭에서 전체 게시물을 볼 수 있습니다.</p>}
        </div>
      )}
    </Section>
  )
}
