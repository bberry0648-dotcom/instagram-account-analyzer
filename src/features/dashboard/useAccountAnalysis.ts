import { useEffect, useMemo, useState } from 'react'
import type { AccountDataset, DataSourceKind } from '../../../shared/types'
import { analyzeAccount } from '../../analytics/analyzeAccount'
import { periodSince, type Period } from '../../analytics/period'
import type { AccountAnalysis } from '../../analytics/types'
import { AnalyzerError } from '../../lib/errors'
import { addRecent } from '../../lib/storage'
import { getProvider } from '../../providers'

type State =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; dataset: AccountDataset }

const SESSION_TTL = 15 * 60 * 1000

/** Session cache so a refresh doesn't spend another API call. Contains only public post data. */
function cacheKey(source: DataSourceKind, username: string, period: Period) {
  return `iaa:ds:${source}:${username}:${period}`
}
function readCache(key: string): AccountDataset | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { at, ds } = JSON.parse(raw) as { at: number; ds: AccountDataset }
    return Date.now() - at < SESSION_TTL ? ds : null
  } catch {
    return null
  }
}
function writeCache(key: string, ds: AccountDataset) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), ds }))
  } catch {
    /* quota — fine */
  }
}

export function useAccountAnalysis(source: DataSourceKind, username: string, period: Period, reloadToken: number) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    const ctrl = new AbortController()
    const key = cacheKey(source, username, period)
    const cached = source === 'imported' || reloadToken > 0 ? null : readCache(key)
    if (cached) {
      setState({ status: 'ready', dataset: cached })
      return
    }
    setState({ status: 'loading' })
    getProvider(source)
      .fetchAccount(username, { since: periodSince(period), signal: ctrl.signal })
      .then((ds) => {
        if (ctrl.signal.aborted) return
        if (source !== 'imported') writeCache(key, ds)
        addRecent({ username: ds.profile.username, source, analyzedAt: new Date().toISOString() })
        setState({ status: 'ready', dataset: ds })
      })
      .catch((error) => {
        if (ctrl.signal.aborted || (error as Error).name === 'AbortError') return
        setState({ status: 'error', error })
      })
    return () => ctrl.abort()
  }, [source, username, period, reloadToken])

  const analysis = useMemo<AccountAnalysis | null>(
    () => (state.status === 'ready' ? analyzeAccount(state.dataset, period) : null),
    [state, period],
  )

  if (state.status === 'ready' && analysis) {
    if (state.dataset.media.length === 0) {
      return { status: 'error' as const, error: new AnalyzerError('NO_POSTS', '이 계정에는 조회할 수 있는 게시물이 없습니다.'), dataset: state.dataset }
    }
    if (analysis.posts.length === 0) {
      return {
        status: 'error' as const,
        error: new AnalyzerError('NO_POSTS', '선택한 기간에 올라온 게시물이 없습니다.'),
        dataset: state.dataset,
      }
    }
    return { status: 'ready' as const, analysis }
  }
  return state.status === 'error' ? { status: 'error' as const, error: state.error, dataset: null } : { status: 'loading' as const }
}
