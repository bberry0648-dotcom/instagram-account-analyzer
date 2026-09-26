import type { InstagramDataProvider, ProviderFetchOptions } from './InstagramDataProvider'
import { fetchAccountFromApi } from '../services/apiClient'

/** Meta Business Discovery, called through our serverless API (the token lives only there). */
export class MetaInstagramProvider implements InstagramDataProvider {
  readonly id = 'meta' as const
  readonly label = 'Meta Instagram API'
  fetchAccount(username: string, opts: ProviderFetchOptions) {
    return fetchAccountFromApi('meta', username, opts.since, opts.signal)
  }
}
