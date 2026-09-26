import type { AccountDataset } from '../../shared/types'
import { ProviderError, type FetchOptions, type ServerProvider } from './types'

/**
 * Adapter slot for a third-party Instagram data API.
 *
 * Intentionally not bound to any vendor. To connect one:
 *   1. Set EXTERNAL_PROVIDER_URL / EXTERNAL_PROVIDER_KEY as server secrets.
 *   2. Implement `mapResponse()` to convert the vendor's JSON into `AccountDataset`
 *      (null for any metric the vendor does not return — never fill in defaults).
 * Until then it reports NOT_CONFIGURED and the UI says so.
 */
export interface ExternalEnv {
  EXTERNAL_PROVIDER_URL?: string
  EXTERNAL_PROVIDER_KEY?: string
  EXTERNAL_PROVIDER_NAME?: string
}

export class ExternalProvider implements ServerProvider {
  readonly id = 'external'
  private readonly env: ExternalEnv
  private readonly fetchImpl: typeof fetch

  constructor(env: ExternalEnv, fetchImpl: typeof fetch = fetch) {
    this.env = env
    this.fetchImpl = fetchImpl
  }

  isConfigured(): boolean {
    return Boolean(this.env.EXTERNAL_PROVIDER_URL && this.env.EXTERNAL_PROVIDER_KEY)
  }

  async fetchAccount(username: string, opts: FetchOptions): Promise<AccountDataset> {
    if (!this.isConfigured()) {
      throw new ProviderError('NOT_CONFIGURED', 503, '외부 데이터 공급자가 연결되지 않았습니다.')
    }
    const url = new URL(this.env.EXTERNAL_PROVIDER_URL!)
    url.searchParams.set('username', username)
    if (opts.since) url.searchParams.set('since', opts.since.toISOString())
    let res: Response
    try {
      res = await this.fetchImpl(url.toString(), {
        headers: { Authorization: `Bearer ${this.env.EXTERNAL_PROVIDER_KEY}` },
      })
    } catch {
      throw new ProviderError('NETWORK', 502, '외부 데이터 공급자에 연결하지 못했습니다.')
    }
    if (res.status === 404) throw new ProviderError('NOT_FOUND_OR_NOT_PROFESSIONAL', 404, `@${username}`)
    if (res.status === 429) throw new ProviderError('RATE_LIMITED', 429)
    if (res.status === 401 || res.status === 403) throw new ProviderError('TOKEN_EXPIRED', 503)
    if (!res.ok) throw new ProviderError('UPSTREAM', 502)
    return this.mapResponse(await res.json())
  }

  /** Vendor-specific mapping. Replace when a vendor is chosen. */
  protected mapResponse(_body: unknown): AccountDataset {
    throw new ProviderError('NOT_CONFIGURED', 503, '외부 공급자 응답 매핑이 아직 구현되지 않았습니다.')
  }
}
