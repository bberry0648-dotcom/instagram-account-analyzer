import type { InstagramDataProvider, ProviderFetchOptions } from './InstagramDataProvider'
import { fetchAccountFromApi } from '../services/apiClient'

/** Third-party data API, proxied by our server (see server/providers/external.ts). */
export class ExternalProvider implements InstagramDataProvider {
  readonly id = 'external' as const
  readonly label = 'External Provider'
  fetchAccount(username: string, opts: ProviderFetchOptions) {
    return fetchAccountFromApi('external', username, opts.since, opts.signal)
  }
}
