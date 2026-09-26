import type { AccountDataset, ApiErrorBody, ProviderErrorCode } from '../../shared/types'
import { AnalyzerError } from '../lib/errors'

/** Public base URL of the serverless API. Contains no secrets. Empty = import-only mode. */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0
}

export async function fetchAccountFromApi(
  provider: 'meta' | 'external',
  username: string,
  since: Date | null,
  signal?: AbortSignal,
): Promise<AccountDataset> {
  if (!isApiConfigured()) {
    throw new AnalyzerError('NOT_CONFIGURED', '이 사이트에는 아직 데이터 수집 서버(API)가 연결되지 않았습니다.')
  }
  const url = new URL(`${API_BASE_URL}/api/account`)
  url.searchParams.set('username', username)
  url.searchParams.set('provider', provider)
  if (since) url.searchParams.set('since', startOfDayIso(since))

  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new AnalyzerError('NETWORK')
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new AnalyzerError('UPSTREAM')
  }
  if (!res.ok) {
    const e = (body as ApiErrorBody)?.error
    throw new AnalyzerError((e?.code ?? 'UNKNOWN') as ProviderErrorCode, e?.detail)
  }
  return body as AccountDataset
}

/** Day granularity so the server cache can be shared between requests. */
function startOfDayIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
}

export type ApiStatus = 'not-configured' | 'unreachable' | 'no-credentials' | 'ready'

/** Asks the API whether the Meta provider actually has credentials (without revealing them). */
export async function checkApiStatus(signal?: AbortSignal): Promise<ApiStatus> {
  if (!isApiConfigured()) return 'not-configured'
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { signal })
    const body = (await res.json()) as { providers?: Record<string, boolean> }
    return body.providers?.meta ? 'ready' : 'no-credentials'
  } catch {
    return 'unreachable'
  }
}
