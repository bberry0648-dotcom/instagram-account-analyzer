import { useEffect, useState } from 'react'
import { Button, Icon, cx } from '../components/ui'
import { ImportDialog } from '../features/import/ImportDialog'
import { parseInstagramInput } from '../features/instagram/parseUsername'
import { fmtDate } from '../lib/format'
import { accountPath, navigate } from '../lib/router'
import { clearRecent, getRecent, removeRecent, type RecentEntry } from '../lib/storage'
import { getApiHealth, preferredSource, type ApiHealth } from '../services/apiClient'

function statusText(h: ApiHealth | null): string {
  if (!h) return '데이터 서버 확인 중…'
  if (h.source === 'meta') return 'Meta Instagram API 연결됨 · 공개 Business/Creator 계정 분석 가능'
  if (h.source === 'external') return `외부 데이터 서비스 연결됨 · 공개 계정 분석 가능${h.accessCodeRequired ? ' (접근 코드 필요)' : ''}`
  if (h.status === 'no-credentials') return 'API 서버에 데이터 공급자가 아직 설정되지 않음 · 가져오기로 분석 가능'
  if (h.status === 'unreachable') return 'API 서버에 연결할 수 없음 · 가져오기로 분석 가능'
  return 'API 서버 미연결 · 가져오기로만 분석 가능'
}

const SOURCE_LABEL = { meta: 'Meta API', external: 'External', imported: 'Imported' } as const

export function HomePage() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>(getRecent)
  const [importOpen, setImportOpen] = useState(false)
  const [health, setHealth] = useState<ApiHealth | null>(null)

  useEffect(() => {
    let alive = true
    getApiHealth().then((h) => alive && setHealth(h))
    return () => {
      alive = false
    }
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = parseInstagramInput(value)
    if (!r.ok) {
      setError(r.reason)
      return
    }
    setError(null)
    preferredSource().then((src) => navigate(accountPath(src, r.username)))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[18vh] pb-16">
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">Instagram Account Analyzer</h1>
      <p className="mt-2 text-[15px] text-ink-2">Discover what content works, what goes viral, and why.</p>

      <form onSubmit={submit} className="mt-8" noValidate>
        <label htmlFor="account" className="sr-only">
          Instagram URL 또는 @username
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div
            className={cx(
              'flex h-11 shrink-0 items-center gap-2 rounded-lg border sm:flex-1 bg-surface px-3 focus-within:ring-2 focus-within:ring-accent/30',
              error ? 'border-bad' : 'border-line-strong focus-within:border-accent',
            )}
          >
            <Icon name="search" className="size-4 shrink-0 text-ink-3" />
            <input
              id="account"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Paste Instagram URL or @username"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              enterKeyHint="go"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'account-error' : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-base focus-visible:outline-none text-ink outline-none placeholder:text-ink-3 sm:text-sm"
            />
          </div>
          <Button type="submit" variant="primary" className="h-11 px-4">
            Analyze Account
          </Button>
        </div>
        {error && (
          <p id="account-error" role="alert" className="mt-2 text-sm text-bad">
            {error}
          </p>
        )}
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className={cx('size-1.5 rounded-full', health?.status === 'ready' ? 'bg-good' : !health ? 'bg-line-strong' : 'bg-warn')} />
          {statusText(health)}
        </span>
        <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
          <Icon name="upload" className="size-3.5" />
          JSON/CSV 가져오기
        </button>
      </div>

      {recent.length > 0 && (
        <section className="mt-12">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-ink-3 uppercase">Recent Analysis</h2>
            <button
              type="button"
              className="text-xs text-ink-3 hover:text-ink"
              onClick={() => {
                clearRecent()
                setRecent([])
              }}
            >
              모두 지우기
            </button>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {recent.map((r) => (
              <li key={`${r.source}:${r.username}`} className="flex items-center">
                <a
                  href={`#${accountPath(r.source, r.username)}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 hover:bg-surface-2"
                >
                  <span className="truncate text-sm font-medium text-ink">@{r.username}</span>
                  <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-3">{SOURCE_LABEL[r.source]}</span>
                  <span className="tabular ml-auto shrink-0 text-xs text-ink-3">{fmtDate(r.analyzedAt)}</span>
                </a>
                <button
                  type="button"
                  aria-label={`@${r.username} 기록 삭제`}
                  onClick={() => setRecent(removeRecent(r.username, r.source))}
                  className="flex size-10 shrink-0 items-center justify-center text-ink-3 hover:text-ink"
                >
                  <Icon name="x" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-auto pt-16 text-xs leading-relaxed text-ink-3">
        공개 계정의 게시물 지표만 조회합니다(Meta 공식 API 또는 외부 데이터 서비스). 비공개 계정은 분석할 수 없으며, 데이터가 없을 때 결과를 추정해 채우지
        않습니다.
      </p>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </main>
  )
}
