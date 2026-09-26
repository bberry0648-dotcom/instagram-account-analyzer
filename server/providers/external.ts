import type { AccountDataset } from '../../shared/types'
import { fetchFromApify } from './apify'
import { ProviderError, type FetchOptions, type ServerProvider } from './types'

/**
 * Third-party Instagram data source. Vendor chosen by EXTERNAL_PROVIDER_NAME; each vendor is an
 * adapter that returns the shared `AccountDataset`, so replacing the vendor touches one file.
 *
 *   EXTERNAL_PROVIDER_NAME=apify
 *   EXTERNAL_PROVIDER_KEY=<vendor API token>          (secret)
 *   EXTERNAL_MAX_POSTS=150                            (cost cap per analysis)
 */
export interface ExternalEnv {
  EXTERNAL_PROVIDER_NAME?: string
  EXTERNAL_PROVIDER_KEY?: string
  EXTERNAL_MAX_POSTS?: string
}

const ADAPTERS = ['apify'] as const

export class ExternalProvider implements ServerProvider {
  readonly id = 'external'
  private readonly env: ExternalEnv
  private readonly fetchImpl: typeof fetch

  constructor(env: ExternalEnv, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
    this.env = env
    this.fetchImpl = fetchImpl
  }

  private get name() {
    return (this.env.EXTERNAL_PROVIDER_NAME ?? '').toLowerCase()
  }

  isConfigured(): boolean {
    return Boolean(this.env.EXTERNAL_PROVIDER_KEY) && (ADAPTERS as readonly string[]).includes(this.name)
  }

  async fetchAccount(username: string, opts: FetchOptions): Promise<AccountDataset> {
    if (!this.isConfigured()) {
      throw new ProviderError('NOT_CONFIGURED', 503, '외부 데이터 공급자가 연결되지 않았습니다.')
    }
    const maxPosts = Math.min(500, Math.max(12, Number.parseInt(this.env.EXTERNAL_MAX_POSTS ?? '', 10) || 150))
    switch (this.name) {
      case 'apify':
        return fetchFromApify(username, opts, { token: this.env.EXTERNAL_PROVIDER_KEY!, maxPosts, fetchImpl: this.fetchImpl })
      default:
        throw new ProviderError('NOT_CONFIGURED', 503)
    }
  }
}
