import type { InstagramDataProvider } from './InstagramDataProvider'
import { AnalyzerError } from '../lib/errors'
import { loadImported } from '../lib/storage'

/** Serves datasets the user imported from JSON/CSV (kept in this browser only). */
export class ImportedDataProvider implements InstagramDataProvider {
  readonly id = 'imported' as const
  readonly label = 'Imported Data'
  async fetchAccount(username: string) {
    const ds = loadImported(username)
    if (!ds) {
      throw new AnalyzerError('NO_POSTS', '가져온 데이터가 이 브라우저에 남아 있지 않습니다. 파일을 다시 가져와 주세요.')
    }
    return ds
  }
}
