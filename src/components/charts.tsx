import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalyzedPost, Dimension, MonthStat } from '../analytics/types'
import { FORMAT_LABEL, formatGroup } from '../analytics/types'
import { fmtRatio } from '../analytics/viralScore'
import { fmtDate, fmtNum, fmtPct, truncate } from '../lib/format'

const AXIS = { fontSize: 11, fill: 'var(--text-3)' }
const GRID = { stroke: 'var(--grid)', strokeDasharray: undefined, vertical: false }
export const FORMAT_COLOR: Record<'REELS' | 'CAROUSEL' | 'IMAGE', string> = {
  REELS: 'var(--series-1)',
  CAROUSEL: 'var(--series-2)',
  IMAGE: 'var(--series-3)',
}

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-60 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink shadow-lg">{children}</div>
  )
}

/** Each post's Viral Score (0–100), chronological. Viral posts emphasised, threshold marked. */
export function PostPerformanceChart({ posts, threshold }: { posts: AnalyzedPost[]; threshold: number }) {
  const data = [...posts]
    .filter((p) => p.viral.score !== null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((p) => ({ id: p.id, score: p.viral.score!, date: fmtDate(p.timestamp).slice(5), post: p }))
  if (data.length < 3) return <ChartEmpty />
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={1}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" tick={AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={30} />
          <ReferenceLine
            y={threshold}
            stroke="var(--text-3)"
            strokeWidth={1}
            label={{ value: `바이럴 기준 ${threshold}`, position: 'insideTopRight', fontSize: 10, fill: 'var(--text-3)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const p = (payload[0].payload as { post: AnalyzedPost }).post
              return (
                <TooltipBox>
                  <div className="font-medium">
                    {FORMAT_LABEL[p.format]} · {fmtDate(p.timestamp)}
                  </div>
                  <div className="mt-0.5 text-ink-2">{truncate(p.caption, 60) || '캡션 없음'}</div>
                  <div className="tabular mt-1">
                    Viral Score {p.viral.score} · 성과지수 {p.viral.performanceIndex !== null ? `${fmtRatio(p.viral.performanceIndex)}×` : '—'}
                  </div>
                  {p.viral.isViral && <div className="mt-0.5 font-medium text-accent-text">VIRAL</div>}
                </TooltipBox>
              )
            }}
          />
          <Bar dataKey="score" radius={[3, 3, 0, 0]} maxBarSize={18}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.post.viral.isViral ? 'var(--series-1)' : 'var(--muted-mark)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Histogram of Viral Scores with the viral threshold marked. */
export function ScoreDistributionChart({ posts }: { posts: AnalyzedPost[] }) {
  const scores = posts.map((p) => p.viral.score).filter((s): s is number => s !== null)
  if (scores.length < 3) return <ChartEmpty />
  const bins = Array.from({ length: 10 }, (_, i) => ({ bin: `${i * 10}`, from: i * 10, count: 0 }))
  for (const s of scores) bins[Math.min(9, Math.floor(s / 10))].count++
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={bins} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="bin" tick={AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TooltipBox>
                  Viral Score {(payload[0].payload as { from: number }).from}–{(payload[0].payload as { from: number }).from + 9}:{' '}
                  <b className="tabular">{payload[0].value}개</b>
                </TooltipBox>
              ) : null
            }
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {bins.map((b) => (
              <Cell key={b.bin} fill={b.from >= 70 ? 'var(--series-1)' : 'var(--muted-mark)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Median performance per group (single series, horizontal). */
export function GroupPerformanceChart({ dim, colorByFormat = false }: { dim: Dimension; colorByFormat?: boolean }) {
  const data = dim.groups
    .filter((g) => g.medianPerf !== null)
    .map((g) => ({ key: g.key, perf: Number(g.medianPerf!.toFixed(2)), n: g.count, weak: g.count < 3 }))
    .sort((a, b) => b.perf - a.perf)
  if (data.length === 0) return <ChartEmpty />
  const colorFor = (key: string) => {
    if (!colorByFormat) return 'var(--series-1)'
    const f = (Object.keys(FORMAT_LABEL) as (keyof typeof FORMAT_LABEL)[]).find((k) => FORMAT_LABEL[k] === key)
    return f ? FORMAT_COLOR[formatGroup(f)] : 'var(--series-1)'
  }
  return (
    <div className="w-full" style={{ height: Math.max(96, data.length * 34 + 28) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}×`} />
          <YAxis type="category" dataKey="key" tick={{ ...AXIS, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} width={104} />
          <ReferenceLine x={1} stroke="var(--text-3)" />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload as (typeof data)[number]
              return (
                <TooltipBox>
                  <div className="font-medium">{d.key}</div>
                  <div className="tabular">
                    성과지수 중앙값 {d.perf}× · {d.n}개{d.weak ? ' (표본 부족)' : ''}
                  </div>
                </TooltipBox>
              )
            }}
          />
          <Bar
            dataKey="perf"
            radius={[0, 3, 3, 0]}
            maxBarSize={18}
            label={{ position: 'right', fontSize: 11, fill: 'var(--text-2)', formatter: (v: unknown) => `${v}×` }}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={colorFor(d.key)} fillOpacity={d.weak ? 0.35 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Monthly post count and median performance as two small charts (never dual-axis). */
export function MonthlyCharts({ months, activeKey, onSelect }: { months: MonthStat[]; activeKey: string | null; onSelect: (k: string) => void }) {
  if (months.length < 2) return <ChartEmpty text="월별 비교에는 2개월 이상의 데이터가 필요합니다." />
  const data = months.map((m) => ({
    key: m.key,
    label: m.label.slice(0, 3),
    count: m.count,
    perf: m.medianPerf !== null ? Number(m.medianPerf.toFixed(2)) : null,
    er: m.avgEngagementRate,
  }))
  const chart = (dataKey: 'count' | 'perf', title: string, fmt: (v: number) => string) => (
    <div>
      <div className="mb-1 text-xs text-ink-3">{title}</div>
      <div className="h-36">
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            onClick={(s) => {
              const k = (s as { activeLabel?: string; activePayload?: { payload: { key: string } }[] })?.activePayload?.[0]?.payload.key
              if (k) onSelect(k)
            }}
          >
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={fmt} width={34} allowDecimals={dataKey === 'perf'} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as (typeof data)[number]
                return (
                  <TooltipBox>
                    <div className="font-medium">{d.key}</div>
                    <div className="tabular">게시물 {d.count}개 · 성과지수 {d.perf ?? '—'}× · 평균 ER {fmtPct(d.er, 2)}</div>
                  </TooltipBox>
                )
              }}
            />
            <Bar dataKey={dataKey} radius={[3, 3, 0, 0]} maxBarSize={36} className="cursor-pointer">
              {data.map((d) => (
                <Cell key={d.key} fill={activeKey === null || activeKey === d.key ? 'var(--series-1)' : 'var(--muted-mark)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {chart('count', '월별 게시물 수', (v) => fmtNum(v))}
      {chart('perf', '월별 성과지수 중앙값 (× 계정 중앙값)', (v) => `${v}×`)}
    </div>
  )
}

/** 100% stacked bar of format share + legend with direct labels (≤3 series). */
export function FormatShareBar({ share, counts }: { share: Record<'REELS' | 'CAROUSEL' | 'IMAGE', number>; counts: Record<string, number> }) {
  const keys = (['REELS', 'CAROUSEL', 'IMAGE'] as const).filter((k) => share[k] > 0)
  if (keys.length === 0) return <ChartEmpty />
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={keys.map((k) => `${FORMAT_LABEL[k]} ${Math.round(share[k] * 100)}%`).join(', ')}>
        {keys.map((k) => (
          <div key={k} style={{ width: `${share[k] * 100}%`, background: FORMAT_COLOR[k] }} title={`${FORMAT_LABEL[k]} ${fmtPct(share[k], 0)}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {keys.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: FORMAT_COLOR[k] }} />
            {FORMAT_LABEL[k]} <span className="tabular font-medium text-ink">{fmtPct(share[k], 0)}</span>
            <span className="tabular text-ink-3">({counts[k] ?? 0})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChartEmpty({ text = '그래프를 그리기에 데이터가 부족합니다.' }: { text?: string }) {
  return <div className="flex h-24 items-center justify-center rounded-lg bg-surface-2 text-xs text-ink-3">{text}</div>
}
