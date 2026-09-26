import type { AccountDataset, ProviderErrorCode } from '../../shared/types'

export interface FetchOptions {
  /** Only posts on/after this date are needed. `null` = everything the source can return. */
  since: Date | null
}

/** Server-side data source. Each implementation owns its own credentials (from env). */
export interface ServerProvider {
  readonly id: string
  isConfigured(): boolean
  fetchAccount(username: string, opts: FetchOptions): Promise<AccountDataset>
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  /** Safe, user-facing detail. */
  readonly detail?: string
  readonly status: number

  constructor(code: ProviderErrorCode, status: number, detail?: string, internal?: string) {
    super(internal ?? code)
    this.code = code
    this.status = status
    this.detail = detail
  }
}
