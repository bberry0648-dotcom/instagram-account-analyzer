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

  const headers: Record<string, string> = {}
  const code = getAccessCode()
  if (code) headers['X-Access-Code'] = code

  let res: Response
  try {
    res = await fetch(url, { signal, headers })
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

const ACCESS_KEY = 'iaa:access-code'

/** Shared access code for the API. sessionStorage only (cleared when the tab closes), never localStorage. */
export function getAccessCode(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_KEY)
  } catch {
    return null
  }
}
export function setAccessCode(code: string): void {
  try {
    sessionStorage.setItem(ACCESS_KEY, code)
  } catch {
    /* private mode — the code just won't persist */
  }
}

export type ApiStatus = 'not-configured' | 'unreachable' | 'no-credentials' | 'ready'

export interface ApiHealth {
  status: ApiStatus
  /** Which provider the search box should use. */
  source: 'meta' | 'external' | null
  accessCodeRequired: boolean
}

let healthPromise: Promise<ApiHealth> | null = null

/** Asks the API which providers have credentials (booleans only, never the secrets). Cached per page load. */
export function getApiHealth(): Promise<ApiHealth> {
  if (!isApiConfigured()) return Promise.resolve({ status: 'not-configured', source: null, accessCodeRequired: false })
  healthPromise ??= fetch(`${API_BASE_URL}/api/health`)
    .then((r) => r.json() as Promise<{ providers?: Record<string, boolean>; accessCodeRequired?: boolean }>)
    .then((b): ApiHealth => {
      const source = b.providers?.meta ? 'meta' : b.providers?.external ? 'external' : null
      return { status: source ? 'ready' : 'no-credentials', source, accessCodeRequired: Boolean(b.accessCodeRequired) }
    })
    .catch((): ApiHealth => {
      healthPromise = null
      return { status: 'unreachable', source: null, accessCodeRequired: false }
    })
  return healthPromise
}

/** Provider for a new search: Meta when connected, otherwise the external provider. */
export async function preferredSource(): Promise<'meta' | 'external'> {
  return (await getApiHealth()).source ?? 'meta'
}
