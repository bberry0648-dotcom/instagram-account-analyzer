import type { AccountDataset } from '../../shared/types'

export interface ProviderFetchOptions {
  since: Date | null
  signal?: AbortSignal
}

/**
 * Anything that can produce an `AccountDataset` for a username.
 * The analytics layer only ever sees `AccountDataset`, so sources are swappable.
 */
export interface InstagramDataProvider {
  readonly id: 'meta' | 'external' | 'imported'
  readonly label: string
  fetchAccount(username: string, opts: ProviderFetchOptions): Promise<AccountDataset>
}
