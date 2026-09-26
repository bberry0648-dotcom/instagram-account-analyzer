export type ParseResult =
  | { ok: true; username: string }
  | { ok: false; reason: string }

import { isValidUsername } from '../../../shared/username'

export { isValidUsername }

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am', 'www.instagr.am'])

/** Path segments that are Instagram pages, not accounts. */
const RESERVED_PATHS = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'accounts', 'direct', 'about', 'legal',
  'developer', 'web', 'challenge', 'emails', 'privacy', 'session', 'login', 'signup',
])

/**
 * Accepts `https://www.instagram.com/nike/`, `instagram.com/nike?igsh=..`, `@nike`, `nike`,
 * and `instagram.com/stories/nike/123`. Returns a lowercase username.
 */
export function parseInstagramInput(raw: string): ParseResult {
  const input = raw.trim()
  if (!input) return { ok: false, reason: 'Instagram 주소 또는 @username을 입력해 주세요.' }

  const looksLikeUrl = /^(https?:\/\/)?([a-z0-9-]+\.)*(instagram\.com|instagr\.am)(\/|$)/i.test(input)
  if (looksLikeUrl) {
    let url: URL
    try {
      url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
    } catch {
      return { ok: false, reason: '주소 형식을 읽을 수 없습니다.' }
    }
    if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) {
      return { ok: false, reason: 'instagram.com 주소가 아닙니다.' }
    }
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return { ok: false, reason: '주소에 계정 이름이 없습니다.' }

    let candidate = segments[0].toLowerCase()
    if (candidate === 'stories' && segments[1]) candidate = segments[1].toLowerCase()
    else if (RESERVED_PATHS.has(candidate)) {
      return {
        ok: false,
        reason: '게시물·릴스 주소가 아니라 계정 프로필 주소를 입력해 주세요. 예: instagram.com/nike',
      }
    }
    candidate = candidate.replace(/^@/, '')
    return isValidUsername(candidate)
      ? { ok: true, username: candidate }
      : { ok: false, reason: `"${candidate}"은(는) 올바른 Instagram 계정 이름이 아닙니다.` }
  }

  if (/^https?:\/\//i.test(input) || /\.(com|net|org|kr|io)(\/|$)/i.test(input)) {
    return { ok: false, reason: 'instagram.com 주소가 아닙니다.' }
  }

  const candidate = input.replace(/^@/, '').toLowerCase()
  if (!isValidUsername(candidate)) {
    return {
      ok: false,
      reason: '계정 이름은 영문·숫자·마침표(.)·밑줄(_)로 된 30자 이하여야 합니다.',
    }
  }
  return { ok: true, username: candidate }
}
