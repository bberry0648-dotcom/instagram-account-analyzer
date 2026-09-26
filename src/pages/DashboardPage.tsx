import { useEffect, useState } from 'react'
import type { DataSourceKind } from '../../shared/types'
import { DEFAULT_PERIOD, isPeriod, PERIODS, type Period } from '../analytics/period'
import { Button, Icon, Segmented, cx } from '../components/ui'
import { CompareDialog } from '../features/dashboard/CompareDialog'
import { InsightsTab } from '../features/dashboard/InsightsTab'
import { OverviewTab } from '../features/dashboard/OverviewTab'
import { PatternsTab } from '../features/dashboard/PatternsTab'
import { PostsTab, ViralTab } from '../features/dashboard/PostTabs'
import { DataNotes, ProfileHeader } from '../features/dashboard/ProfileHeader'
import { useAccountAnalysis } from '../features/dashboard/useAccountAnalysis'
import { ImportDialog } from '../features/import/ImportDialog'
import { parseInstagramInput } from '../features/instagram/parseUsername'
import { describeError } from '../lib/errors'
import { accountPath, navigate } from '../lib/router'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'viral', label: 'Viral' },
  { id: 'posts', label: 'Posts' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'insights', label: 'Insights' },
] as const
type Tab = (typeof TABS)[number]['id']

const PERIOD_OPTIONS = PERIODS.map((p) => ({ id: p.id, label: p.id === 'all' ? '전체' : p.label.replace('최근 ', '') }))

export function DashboardPage({ source, username, tab, period }: { source: DataSourceKind; username: string; tab: string; period: string | null }) {
  const activeTab: Tab = TABS.some((t) => t.id === tab) ? (tab as Tab) : 'overview'
  const p: Period = isPeriod(period) ? period : DEFAULT_PERIOD
  const [reload, setReload] = useState(0)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const result = useAccountAnalysis(source, username, p, reload)

  useEffect(() => {
    setCompareIds([])
  }, [source, username, p])
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
    window.scrollTo({ top: 0 })
    setCompareOpen(false)
  }, [activeTab])

  const go = (nextTab: string, nextPeriod: Period = p) =>
    navigate(accountPath(source, username, nextTab), nextPeriod === DEFAULT_PERIOD ? undefined : { period: nextPeriod })

  const toggleCompare = (id: string) =>
    setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 4 ? ids : [...ids, id]))

  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-6">
        {result.status === 'loading' && <LoadingState username={username} source={source} />}

        {result.status === 'error' && (
          <ErrorState
            error={result.error}
            username={username}
            onRetry={() => setReload((n) => n + 1)}
            onImport={() => setImportOpen(true)}
            onPeriodAll={p !== 'all' && result.dataset && result.dataset.media.length > 0 ? () => go(activeTab, 'all') : undefined}
          />
        )}

        {result.status === 'ready' && (
          <>
            <ProfileHeader a={result.analysis} />
            <div className="mt-4">
              <DataNotes a={result.analysis} />
            </div>

            <div className="sticky top-12 z-20 -mx-4 mt-5 border-b border-line bg-bg/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="flex flex-col gap-2 py-2 md:flex-row md:items-center md:justify-between">
                <nav className="scrollbar-none -mb-2 flex gap-1 overflow-x-auto md:mb-0" aria-label="분석 화면">
                  {TABS.map((t) => (
                    <a
                      key={t.id}
                      href={`#${accountPath(source, username, t.id)}${p === DEFAULT_PERIOD ? '' : `?period=${p}`}`}
                      aria-current={activeTab === t.id ? 'page' : undefined}
                      className={cx(
                        'relative shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        activeTab === t.id ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink',
                      )}
                    >
                      {t.label}
                      {t.id === 'viral' && (
                        <span className="tabular ml-1.5 rounded bg-accent-soft px-1 text-[10px] text-accent-text">{result.analysis.overview.viralCount}</span>
                      )}
                    </a>
                  ))}
                </nav>
                <Segmented label="분석 기간" value={p} options={PERIOD_OPTIONS} onChange={(v) => go(activeTab, v)} />
              </div>
            </div>

            <div className="mt-5">
              {activeTab === 'overview' && <OverviewTab a={result.analysis} onOpenTab={(t) => go(t)} />}
              {activeTab === 'viral' && <ViralTab a={result.analysis} compareIds={compareIds} onToggleCompare={toggleCompare} />}
              {activeTab === 'posts' && <PostsTab a={result.analysis} compareIds={compareIds} onToggleCompare={toggleCompare} />}
              {activeTab === 'patterns' && <PatternsTab a={result.analysis} />}
              {activeTab === 'insights' && <InsightsTab a={result.analysis} />}
            </div>

            {compareIds.length > 0 && (
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                  <span className="text-sm text-ink-2">
                    <b className="tabular text-ink">{compareIds.length}</b>/4 선택 {compareIds.length < 2 && <span className="text-ink-3">· 1개 더 고르세요</span>}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setCompareIds([])}>
                      해제
                    </Button>
                    <Button variant="primary" disabled={compareIds.length < 2} onClick={() => setCompareOpen(true)}>
                      비교하기
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {compareOpen && (
              <CompareDialog
                posts={compareIds.map((id) => result.analysis.posts.find((x) => x.id === id)!).filter(Boolean)}
                onClose={() => setCompareOpen(false)}
              />
            )}
          </>
        )}
      </main>
      {importOpen && <ImportDialog defaultUsername={username} onClose={() => setImportOpen(false)} />}
    </div>
  )
}

function TopBar() {
  const [q, setQ] = useState('')
  const [err, setErr] = useState(false)
  return (
    <header className="sticky top-0 z-30 h-12 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a href="#/" className="flex shrink-0 items-center gap-2 text-sm font-semibold text-ink">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-5" />
          <span className="hidden sm:inline">Instagram Account Analyzer</span>
        </a>
        <form
          className="ml-auto w-full max-w-64"
          onSubmit={(e) => {
            e.preventDefault()
            const r = parseInstagramInput(q)
            if (!r.ok) return setErr(true)
            setErr(false)
            setQ('')
            navigate(accountPath('meta', r.username))
          }}
        >
          <label className="sr-only" htmlFor="topbar-search">
            다른 계정 분석
          </label>
          <div className={cx('flex h-8 items-center gap-2 rounded-md border bg-surface px-2', err ? 'border-bad' : 'border-line')}>
            <Icon name="search" className="size-3.5 shrink-0 text-ink-3" />
            <input
              id="topbar-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setErr(false)
              }}
              placeholder="@username 또는 URL"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-base focus-visible:outline-none text-ink outline-none placeholder:text-ink-3 sm:text-xs"
            />
          </div>
        </form>
      </div>
    </header>
  )
}

function LoadingState({ username, source }: { username: string; source: DataSourceKind }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <p className="mb-5 text-sm text-ink-2">
        @{username} {source === 'imported' ? '가져온 데이터를 분석하는 중…' : '게시물을 Instagram API에서 불러오는 중… (게시물이 많으면 10초 이상 걸릴 수 있습니다)'}
      </p>
      <div className="flex gap-4">
        <div className="size-20 rounded-full bg-surface-2" />
        <div className="flex-1 space-y-2 pt-2">
          <div className="h-4 w-40 rounded bg-surface-2" />
          <div className="h-3 w-64 max-w-full rounded bg-surface-2" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 rounded-lg bg-surface-2" />
        ))}
      </div>
      <div className="mt-4 h-56 rounded-xl bg-surface-2" />
    </div>
  )
}

function ErrorState({
  error,
  username,
  onRetry,
  onImport,
  onPeriodAll,
}: {
  error: unknown
  username: string
  onRetry: () => void
  onImport: () => void
  onPeriodAll?: () => void
}) {
  const e = describeError(error)
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border border-line bg-surface p-6" role="alert">
      <div className="text-xs font-medium text-ink-3">@{username}</div>
      <h1 className="mt-1 text-lg font-semibold">{e.title}</h1>
      <p className="mt-2 text-sm text-ink-2">{e.reason}</p>
      {e.hint && <p className="mt-2 text-sm text-ink-3">{e.hint}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {onPeriodAll && (
          <Button variant="primary" onClick={onPeriodAll}>
            전체 기간으로 보기
          </Button>
        )}
        <Button onClick={onRetry}>다시 시도</Button>
        <Button onClick={onImport}>
          <Icon name="upload" className="size-3.5" /> JSON/CSV 가져오기
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')}>
          <Icon name="arrow-left" className="size-3.5" /> 처음으로
        </Button>
      </div>
    </div>
  )
}
