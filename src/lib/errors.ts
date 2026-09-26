import type { ProviderErrorCode } from '../../shared/types'

export class AnalyzerError extends Error {
  readonly code: ProviderErrorCode
  readonly detail?: string
  constructor(code: ProviderErrorCode, detail?: string) {
    super(code)
    this.code = code
    this.detail = detail
  }
}

export interface FriendlyError {
  title: string
  reason: string
  hint?: string
}

/** Maps error codes to plain-language messages. Raw upstream messages are never shown. */
export function describeError(err: unknown, source: 'meta' | 'external' | 'imported' = 'meta'): FriendlyError {
  const code: ProviderErrorCode = err instanceof AnalyzerError ? err.code : 'UNKNOWN'
  const title = '현재 이 계정의 데이터를 가져올 수 없습니다.'
  const detail = err instanceof AnalyzerError ? err.detail : undefined
  switch (code) {
    case 'ACCESS_CODE_REQUIRED':
      return {
        title: '접근 코드가 필요합니다.',
        reason: '이 사이트의 계정 검색은 유료 데이터 크레딧을 쓰기 때문에 접근 코드를 아는 사람만 사용할 수 있습니다.',
      }
    case 'INVALID_INPUT':
      return { title: '입력한 주소를 확인해 주세요.', reason: (err as AnalyzerError).detail ?? '올바른 Instagram 계정 주소가 아닙니다.' }
    case 'NOT_FOUND_OR_NOT_PROFESSIONAL':
      if (source === 'external') {
        return {
          title,
          reason: '계정이 없거나 삭제되었거나, 주소가 잘못됐습니다.',
          hint: '계정 이름의 철자를 확인해 주세요.',
        }
      }
      return {
        title,
        reason:
          '계정이 없거나 삭제되었거나, 비공개·개인(Personal) 계정이거나, 연령 제한이 걸린 계정입니다. Meta API는 이 경우들을 구분해서 알려 주지 않습니다.',
        hint: 'Instagram 공식 API는 공개된 Business·Creator 계정만 조회할 수 있습니다. 직접 받은 데이터가 있다면 JSON/CSV 가져오기를 사용하세요.',
      }
    case 'PRIVATE_OR_RESTRICTED':
      return { title, reason: '비공개 계정이라 게시물을 볼 수 없습니다.', hint: '공개 계정만 분석할 수 있습니다.' }
    case 'RATE_LIMITED':
      return detail
        ? { title, reason: detail, hint: '사이트 관리자가 데이터 서비스 한도를 확인해야 합니다.' }
        : { title, reason: '데이터 서비스 호출 한도에 도달했습니다.', hint: '잠시(보통 1시간 이내) 뒤에 다시 시도해 주세요.' }
    case 'TOKEN_EXPIRED':
      return { title, reason: '서버의 데이터 서비스 인증이 만료되었거나 잘못되었습니다.', hint: '사이트 관리자가 액세스 토큰(API 키)을 확인해야 합니다.' }
    case 'NOT_CONFIGURED':
      return {
        title,
        reason: (err as AnalyzerError).detail ?? '데이터 수집 서버가 아직 연결되지 않았습니다.',
        hint: '관리자가 API 서버와 Meta 액세스 토큰을 설정하면 계정 검색이 가능합니다. 그 전에는 JSON/CSV 가져오기로 분석할 수 있습니다.',
      }
    case 'NO_POSTS':
      return { title: '분석할 게시물이 없습니다.', reason: (err as AnalyzerError).detail ?? '선택한 기간에 게시물이 없습니다.', hint: '분석 기간을 늘려 보세요.' }
    case 'NETWORK':
      return { title, reason: '네트워크 연결에 실패했습니다.', hint: '인터넷 연결을 확인하고 다시 시도해 주세요.' }
    case 'UPSTREAM':
      return { title, reason: detail ?? '데이터 서비스가 예상하지 못한 응답을 보냈습니다.', hint: '잠시 뒤 다시 시도해 주세요.' }
    default:
      return { title, reason: '알 수 없는 오류가 발생했습니다.', hint: '잠시 뒤 다시 시도해 주세요.' }
  }
}
