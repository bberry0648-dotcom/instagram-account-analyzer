/**
 * Caption-based content classification (Korean + English keywords).
 *
 * Only the caption text is available from the API — images and video are not analysed.
 * Every label here is therefore an *estimate from the caption*, and the UI says so.
 */

export type ContentType =
  | '이벤트'
  | '프로모션'
  | '튜토리얼'
  | '정보 콘텐츠'
  | '리뷰'
  | 'UGC'
  | 'Behind the Scenes'
  | '제품 소개'
  | '브랜드 스토리'
  | '밈'
  | '일상 콘텐츠'
  | '분류 불가'

export type Hook =
  | '질문형'
  | '숫자 강조'
  | '문제 제기'
  | '결론 선공개'
  | 'Before / After'
  | '호기심 유발'
  | '짧은 헤드라인'
  | '서술형 시작'
  | '캡션 없음'

export type CaptionStyle = '짧은 카피' | '정보형' | 'CTA형' | '대화형' | '스토리텔링' | '일반 서술' | '캡션 없음'

export type Cta = '댓글 유도' | '저장 유도' | '공유 유도' | '프로필 방문' | '구매' | '링크 클릭' | '없음'

export interface CaptionFeatures {
  contentType: ContentType
  hook: Hook
  captionStyle: CaptionStyle
  ctas: Cta[]
  /** Primary CTA (first match by priority) or '없음'. */
  cta: Cta
  /** Caption length excluding hashtags. */
  captionLength: number
  hashtagCount: number
  mentionCount: number
  firstLine: string
}

const CONTENT_RULES: [ContentType, RegExp][] = [
  ['이벤트', /(이벤트|추첨|증정|당첨|경품|giveaway|contest|sweepstake|win a|chance to win)/i],
  ['프로모션', /(할인|세일|특가|쿠폰|프로모션|\d+\s?%\s?(off|할인)|\bsale\b|promo|discount|coupon|use code|limited time)/i],
  ['튜토리얼', /(하는\s?법|방법|튜토리얼|레시피|따라\s?해|단계|how to|tutorial|step[- ]by[- ]step|recipe|diy|guide)/i],
  ['리뷰', /(후기|리뷰|솔직|사용해\s?봤|써\s?봤|review|tested|unboxing|언박싱)/i],
  ['UGC', /(repost|regram|📸\s*[:@]|📷\s*[:@]|photo by @|via @|credit[:\s]+@|by @\w+|shot by)/i],
  ['Behind the Scenes', /(비하인드|촬영\s?현장|제작\s?과정|만드는\s?과정|behind the scenes|\bbts\b|making of|in the studio|sneak peek)/i],
  ['정보 콘텐츠', /(알아보|정리|꿀팁|팁|가지\s|이유|사실|체크리스트|did you know|facts?\b|tips?\b|things to|reasons|checklist|explained)/i],
  ['제품 소개', /(신제품|출시|신상|런칭|론칭|새로운|introducing|new arrival|now available|available now|launch|just dropped|\bdrop\b|collection|meet the)/i],
  ['브랜드 스토리', /(이야기|스토리|창립|우리는|브랜드|since \d{4}|our story|our mission|founded|heritage|legacy|story of)/i],
  ['밈', /(😂|🤣|ㅋㅋ|\bpov\b|\bmeme\b|\blol\b|when you|me when|nobody:|공감)/i],
  ['일상 콘텐츠', /(일상|오늘|주말|데일리|브이로그|daily|weekend|today|vlog|morning|mood|vibes?)/i],
]

const CTA_RULES: [Cta, RegExp][] = [
  ['구매', /(구매|주문|판매|구입|shop now|\bshop\b|\bbuy\b|order now|get yours|available at|pre-?order|장바구니)/i],
  ['링크 클릭', /(링크|클릭|https?:\/\/|click|tap the link|swipe up)/i],
  ['프로필 방문', /(프로필|link in (our )?bio|bio link|in bio|방문해|follow @|팔로우)/i],
  ['댓글 유도', /(댓글|코멘트|comment|tell us|let us know|알려\s?주세요|drop a|which one|어떤\s?게|뭐가 좋)/i],
  ['저장 유도', /(저장|\bsave\b|bookmark|북마크)/i],
  ['공유 유도', /(공유|태그|tag (a|your)|share|send this|친구에게)/i],
]

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu
const MENTION_RE = /@[\w.]+/g

export function classifyCaption(caption: string | null): CaptionFeatures {
  if (!caption || !caption.trim()) {
    return {
      contentType: '분류 불가',
      hook: '캡션 없음',
      captionStyle: '캡션 없음',
      ctas: [],
      cta: '없음',
      captionLength: 0,
      hashtagCount: 0,
      mentionCount: 0,
      firstLine: '',
    }
  }
  const text = caption.trim()
  const hashtagCount = (text.match(HASHTAG_RE) ?? []).length
  const mentionCount = (text.match(MENTION_RE) ?? []).length
  const body = text.replace(HASHTAG_RE, '').trim()
  const firstLine = (body.split(/\n/).find((l) => l.trim()) ?? '').trim()
  const ctas = CTA_RULES.filter(([, re]) => re.test(body)).map(([c]) => c)
  const cta = ctas[0] ?? '없음'

  return {
    contentType: CONTENT_RULES.find(([, re]) => re.test(body))?.[0] ?? '분류 불가',
    hook: detectHook(firstLine),
    captionStyle: detectStyle(body, ctas.length > 0),
    ctas,
    cta,
    captionLength: [...body].length,
    hashtagCount,
    mentionCount,
    firstLine,
  }
}

function detectHook(firstLine: string): Hook {
  if (!firstLine) return '캡션 없음'
  const head = firstLine.slice(0, 120)
  const firstSentence = head.split(/(?<=[.!?。！？])\s/)[0]
  if (/\b(before|after)\b|전후|비포|애프터/i.test(head)) return 'Before / After'
  if (/[?？]/.test(firstSentence)) return '질문형'
  if (/(결론|정답|결과부터|요약|spoiler|tl;?dr|the answer|here'?s (the|what))/i.test(head)) return '결론 선공개'
  if (/(왜\s|문제|실수|고민|망하|하지\s?마|stop\b|mistake|problem|struggl|don'?t|never)/i.test(head)) return '문제 제기'
  if (/(^|\s)\d+([.,]\d+)?\s?(%|가지|개|초|분|일|년|만|x|k\b|ways|things|steps|reasons|tips|days|years)?/i.test(head) && /\d/.test(head.slice(0, 40))) {
    return '숫자 강조'
  }
  if (/(비밀|아무도|몰랐|알고\s?계셨|진짜|드디어|secret|nobody|you won'?t believe|wait for it|finally|guess|coming soon|\.\.\.|…)/i.test(head)) {
    return '호기심 유발'
  }
  if ([...firstLine].length <= 30) return '짧은 헤드라인'
  return '서술형 시작'
}

function detectStyle(body: string, hasCta: boolean): CaptionStyle {
  const len = [...body].length
  if (len === 0) return '캡션 없음'
  const lines = body.split('\n').filter((l) => l.trim())
  const listLines = lines.filter((l) => /^\s*([-•·▪️✔️✅→]|\d+[.)]|[①-⑩])/.test(l)).length
  if (listLines >= 3) return '정보형'
  if (len <= 60) return '짧은 카피'
  if (hasCta && len <= 180) return 'CTA형'
  if (/[?？]/.test(body) && /(여러분|너희|당신|you|your)/i.test(body)) return '대화형'
  if (len >= 250) return '스토리텔링'
  return '일반 서술'
}

export type CaptionLengthBucket = '없음' | '짧음 (≤60자)' | '중간 (61–250자)' | '김 (>250자)'

export function captionLengthBucket(len: number): CaptionLengthBucket {
  if (len === 0) return '없음'
  if (len <= 60) return '짧음 (≤60자)'
  if (len <= 250) return '중간 (61–250자)'
  return '김 (>250자)'
}

// ── Account category (estimate) ─────────────────────────────────────────────

const CATEGORY_RULES: [string, RegExp][] = [
  ['Food', /(food|recipe|restaurant|cafe|coffee|bakery|kitchen|맛집|레시피|카페|커피|베이커리|음식|요리|메뉴|디저트)/i],
  ['Fashion', /(fashion|apparel|outfit|ootd|wear|collection|sneaker|streetwear|패션|코디|옷|신발|의류)/i],
  ['Beauty', /(beauty|makeup|skincare|cosmetic|뷰티|메이크업|스킨케어|화장품)/i],
  ['Sports', /(sport|athlete|football|soccer|basketball|running|training|fitness|gym|운동|축구|야구|러닝|헬스|피트니스)/i],
  ['Tech', /(tech|software|app\b|device|ai\b|developer|gadget|테크|개발|앱|기기)/i],
  ['Travel', /(travel|hotel|trip|destination|여행|호텔|숙소)/i],
  ['Media', /(news|media|magazine|journal|podcast|뉴스|매거진|언론|방송)/i],
  ['Creator', /(creator|youtuber|blogger|artist|illustrat|photographer|크리에이터|유튜버|작가|일러스트|사진가)/i],
  ['Lifestyle', /(lifestyle|home|interior|living|라이프스타일|인테리어|리빙)/i],
]

export interface CategoryEstimate {
  category: string | null
  /** Always true — Business Discovery does not expose the account category. */
  estimated: true
  basis: string
}

export function estimateCategory(bio: string | null, captions: (string | null)[]): CategoryEstimate {
  const scores = new Map<string, number>()
  for (const [cat, re] of CATEGORY_RULES) {
    let s = 0
    if (bio && re.test(bio)) s += 3
    for (const c of captions) if (c && re.test(c)) s += 1
    if (s > 0) scores.set(cat, s)
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const sampleSize = captions.filter(Boolean).length
  // Require a real signal: bio match, or ≥20% of captions.
  if (!ranked.length || ranked[0][1] < Math.max(3, sampleSize * 0.2)) {
    return { category: null, estimated: true, basis: '소개글·캡션에서 뚜렷한 업종 단서를 찾지 못했습니다.' }
  }
  return {
    category: ranked[0][0],
    estimated: true,
    basis: '소개글과 캡션의 키워드로 추정했습니다. Instagram API는 계정 카테고리를 제공하지 않습니다.',
  }
}
