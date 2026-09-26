import type { AccountAnalysis, Dimension } from '../../analytics/types'
import { formatGroup, FORMAT_LABEL } from '../../analytics/types'
import { fmtRatio } from '../../analytics/viralScore'
import { mean, nonNull } from '../../analytics/stats'
import { GroupPerformanceChart } from '../../components/charts'
import { Confidence, Empty, Section, Tag } from '../../components/ui'
import type { GroupStat } from '../../analytics/types'
import { P_STRONG, P_WEAK } from '../../analytics/patterns'
import { fmtNum, fmtPct } from '../../lib/format'

export function PatternsTab({ a }: { a: AccountAnalysis }) {
  const dims = (ids: Dimension['id'][]) => a.dimensions.filter((d) => ids.includes(d.id))
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
        성과지수 = 게시물의 좋아요·댓글·조회수가 각각 계정 중앙값의 몇 배인지의 기하평균입니다. 1×가 이 계정의 평소 수준입니다. 콘텐츠 유형·훅·CTA는 캡션으로만
        추정했으며, 3개 미만 그룹은 흐리게 표시하고 결론에 쓰지 않습니다.
      </p>

      <ViralPatternSection a={a} />
      <FormatTable a={a} />

      <div className="grid gap-4 lg:grid-cols-2">
        {dims(['contentType', 'hook', 'captionStyle', 'cta', 'captionLength', 'weekday']).map((d) => (
          <DimensionSection key={d.id} dim={d} />
        ))}
      </div>
    </div>
  )
}

function DimensionSection({ dim }: { dim: Dimension }) {
  return (
    <Section title={dim.label}>
      <GroupPerformanceChart dim={dim} />
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            <th className="py-1.5 font-medium">그룹</th>
            <th className="py-1.5 text-right font-medium">게시물</th>
            <th className="py-1.5 text-right font-medium">비중</th>
            <th className="py-1.5 text-right font-medium">바이럴</th>
            <th className="py-1.5 text-right font-medium">평소 이상</th>
            <th className="py-1.5 text-right font-medium">차이 근거</th>
          </tr>
        </thead>
        <tbody>
          {dim.groups.map((g) => (
            <tr key={g.key} className="border-b border-line last:border-0">
              <td className="py-1.5 text-ink">{g.key}</td>
              <td className="tabular py-1.5 text-right">{g.count}</td>
              <td className="tabular py-1.5 text-right text-ink-2">{fmtPct(g.share, 0)}</td>
              <td className="tabular py-1.5 text-right text-ink-2">{g.viralCount}</td>
              <td className="tabular py-1.5 text-right text-ink-2">
                {g.aboveMedian}/{g.count}
              </td>
              <td className="py-1.5 text-right">
                <GroupEvidence g={g} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

function ViralPatternSection({ a }: { a: AccountAnalysis }) {
  const viralCount = a.overview.viralCount
  return (
    <Section title="바이럴 패턴" description="바이럴 게시물에 전체보다 더 많이 나타나는 특징 — 우연으로 나올 확률(이항검정) 10% 미만만 표시, 1% 미만이면 근거 충분">
      {a.viralLifts.length === 0 ? (
        <Empty title={viralCount < 2 ? `바이럴 게시물이 ${viralCount}개라 공통점을 찾을 수 없습니다.` : '바이럴 게시물 사이에 뚜렷한 공통점이 없습니다.'} />
      ) : (
        <ul className="divide-y divide-line">
          {a.viralLifts.slice(0, 8).map((l) => (
            <li key={`${l.dimension}:${l.value}`} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <span className="text-ink-3">{l.dimension.replace(/ \(.*\)/, '')}</span> <b className="font-medium text-ink">{l.value}</b>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="tabular text-ink-2">
                  바이럴 {l.viralCount}/{l.viralTotal} ({fmtPct(l.viralShare, 0)}) vs 전체 {fmtPct(l.overallShare, 0)}
                </span>
                <span className="tabular rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent-text">{l.lift.toFixed(1)}×</span>
                <Confidence level={l.confidence} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function FormatTable({ a }: { a: AccountAnalysis }) {
  const rows = (['REELS', 'CAROUSEL', 'IMAGE'] as const).map((f) => {
    const list = a.posts.filter((p) => formatGroup(p.format) === f)
    const g = a.dimensions.find((d) => d.id === 'format')!.groups.find((x) => x.key === FORMAT_LABEL[f])
    return {
      f,
      n: list.length,
      likes: mean(list.map((p) => p.likeCount).filter(nonNull)),
      comments: mean(list.map((p) => p.commentsCount).filter(nonNull)),
      views: f === 'REELS' ? mean(list.map((p) => p.viewCount).filter(nonNull)) : null,
      er: mean(list.map((p) => p.engagementRate).filter(nonNull)),
      perf: g?.medianPerf ?? null,
      viral: list.filter((p) => p.viral.isViral).length,
    }
  })
  return (
    <Section title="Format Performance" description="Reels(영상 포함) · Carousel · Image 평균 지표">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="py-2 font-medium">Format</th>
              <th className="py-2 text-right font-medium">게시물</th>
              <th className="py-2 text-right font-medium">평균 Likes</th>
              <th className="py-2 text-right font-medium">평균 Comments</th>
              <th className="py-2 text-right font-medium">평균 Views</th>
              <th className="py-2 text-right font-medium">평균 ER</th>
              <th className="py-2 text-right font-medium">성과지수</th>
              <th className="py-2 text-right font-medium">Viral</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r.f} className="border-b border-line last:border-0">
                <td className="py-2 font-medium">{FORMAT_LABEL[r.f]}</td>
                <td className="py-2 text-right">{r.n}</td>
                <td className="py-2 text-right">{fmtNum(r.likes)}</td>
                <td className="py-2 text-right">{fmtNum(r.comments)}</td>
                <td className="py-2 text-right">{fmtNum(r.views)}</td>
                <td className="py-2 text-right">{fmtPct(r.er, 2)}</td>
                <td className="py-2 text-right">{r.perf !== null ? `${fmtRatio(r.perf)}×` : '—'}</td>
                <td className="py-2 text-right">{r.viral}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

/** Whether this group really differs from the account's typical post (sign test). */
function GroupEvidence({ g }: { g: GroupStat }) {
  if (g.confidence === 'insufficient') return <Tag>표본 부족</Tag>
  const p = Math.min(g.pBetter, g.pWorse)
  const dir = g.pBetter < g.pWorse ? '높음' : '낮음'
  if (p < P_STRONG) return <Tag tone="good">{dir} · 근거 충분</Tag>
  if (p < P_WEAK) return <Tag tone="warn">{dir} · 참고</Tag>
  return <Tag>차이 불확실</Tag>
}
