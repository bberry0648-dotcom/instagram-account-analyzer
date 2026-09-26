import { fmtRatio } from './viralScore'
import { MIN_GROUP, P_STRONG, P_WEAK } from './patterns'
import type { AnalyzedPost, Dimension, GroupStat, InsightItem, Insights, Overview, ViralLift } from './types'
import { FORMAT_LABEL, formatGroup } from './types'

/**
 * Rule-based insights computed only from this account's numbers.
 * No generic SNS tips: every sentence cites a group size and a ratio vs the account median.
 * Groups with fewer than MIN_GROUP posts are never stated as findings.
 */

const WORKING = 1.2
const NOT_WORKING = 0.8
// Dimensions that are reliable enough to talk about as "what works".
const INSIGHT_DIMS: Dimension['id'][] = ['format', 'contentType', 'hook', 'cta', 'captionStyle', 'captionLength']

const LABELS: Record<Dimension['id'], string> = {
  format: '형식',
  contentType: '콘텐츠 유형',
  hook: '첫 줄 훅',
  captionStyle: '캡션 스타일',
  cta: 'CTA',
  captionLength: '캡션 길이',
  weekday: '게시 요일',
}

function describeGroup(dim: Dimension, g: GroupStat): string {
  return `${LABELS[dim.id]} "${g.key}"`
}

function evidence(g: GroupStat): string {
  const parts = [`${g.count}개 게시물`, `성과지수 중앙값 ${fmtRatio(g.medianPerf ?? 0)}배`, `${g.count}개 중 ${g.aboveMedian}개가 평소 이상`]
  if (g.viralCount) parts.push(`바이럴 ${g.viralCount}개`)
  return parts.join(' · ')
}

export function buildInsights(
  posts: AnalyzedPost[],
  dims: Dimension[],
  lifts: ViralLift[],
  overview: Overview,
): Insights {
  const limitations: string[] = []
  if (posts.length < 10) {
    limitations.push(`분석 게시물이 ${posts.length}개뿐이라 아래 결과는 경향 정도로만 참고하세요.`)
  }
  limitations.push('콘텐츠 유형·훅·CTA는 캡션 텍스트로만 추정했습니다. 영상·이미지 내용과 길이는 API가 제공하지 않아 분석하지 않았습니다.')
  if (overview.likesHiddenCount > 0) {
    limitations.push(`좋아요 수가 숨겨진 게시물 ${overview.likesHiddenCount}개는 댓글·조회수만으로 평가했습니다.`)
  }

  const candidates: { dim: Dimension; g: GroupStat }[] = []
  for (const dim of dims) {
    if (!INSIGHT_DIMS.includes(dim.id)) continue
    // A dimension with a single group says nothing comparative.
    if (dim.groups.filter((g) => g.count >= MIN_GROUP).length < 2) continue
    for (const g of dim.groups) {
      if (g.count >= MIN_GROUP && g.medianPerf !== null && g.key !== '분류 불가' && g.key !== '캡션 없음') candidates.push({ dim, g })
    }
  }

  const working: InsightItem[] = candidates
    .filter(({ g }) => (g.medianPerf ?? 0) >= WORKING && g.pBetter < P_WEAK)
    .sort((a, b) => (b.g.medianPerf ?? 0) - (a.g.medianPerf ?? 0))
    .slice(0, 4)
    .map(({ dim, g }) => ({
      text: `${describeGroup(dim, g)} 게시물의 반응이 계정 평소 수준의 ${fmtRatio(g.medianPerf!)}배입니다.`,
      evidence: evidence(g),
      confidence: g.pBetter < P_STRONG ? 'strong' : 'weak',
    }))

  const notWorking: InsightItem[] = candidates
    .filter(({ g }) => (g.medianPerf ?? 1) <= NOT_WORKING && g.pWorse < P_WEAK)
    .sort((a, b) => (a.g.medianPerf ?? 0) - (b.g.medianPerf ?? 0))
    .slice(0, 4)
    .map(({ dim, g }) => ({
      text: `${describeGroup(dim, g)} 게시물은 계정 평소 수준의 ${fmtRatio(g.medianPerf!)}배로 반응이 낮은 편입니다.`,
      evidence: evidence(g),
      confidence: g.pWorse < P_STRONG ? 'strong' : 'weak',
    }))

  const viralPattern: InsightItem[] = lifts.slice(0, 5).map((l) => ({
    text: `바이럴 게시물 ${l.viralTotal}개 중 ${l.viralCount}개가 ${l.dimension.replace(/ \(.*\)/, '')} "${l.value}"입니다.`,
    evidence: `바이럴 중 비중 ${pct(l.viralShare)} vs 전체 중 비중 ${pct(l.overallShare)} (${l.lift.toFixed(1)}배 집중, 우연일 확률 ${pctP(l.pValue)})`,
    confidence: l.confidence,
  }))
  if (overview.viralCount < 2) {
    limitations.push(
      overview.viralCount === 0
        ? '이 기간에는 바이럴 기준(Viral Score 70 이상 & 한 지표가 중앙값의 2배 이상)을 넘은 게시물이 없어 바이럴 공통점을 뽑을 수 없습니다.'
        : '바이럴 게시물이 1개뿐이라 공통점을 일반화할 수 없습니다.',
    )
  }

  const opportunity: InsightItem[] = []
  const formatDim = dims.find((d) => d.id === 'format')!
  for (const f of ['Reels', 'Carousel', 'Image']) {
    const g = formatDim.groups.find((x) => x.key === f)
    if (!g) {
      opportunity.push({
        text: `이 기간에 ${f} 형식을 사용하지 않았습니다. 이 계정에서 검증되지 않은 형식이라 소규모 테스트 후보입니다.`,
        evidence: `${f} 0개 / 전체 ${posts.length}개`,
        confidence: 'weak',
      })
    } else if (g.share < 0.15 && (g.medianPerf ?? 0) >= WORKING) {
      opportunity.push({
        text: `${f}는 비중이 ${pct(g.share)}로 적지만 반응은 평소의 ${fmtRatio(g.medianPerf!)}배입니다. 비중을 늘려 볼 만합니다.`,
        evidence: evidence(g),
        confidence: g.count >= MIN_GROUP ? 'weak' : 'weak',
      })
    }
  }
  for (const dim of dims.filter((d) => d.id === 'contentType' || d.id === 'hook' || d.id === 'cta')) {
    for (const g of dim.groups) {
      if (g.key === '분류 불가' || g.key === '없음' || g.key === '캡션 없음' || g.key === '서술형 시작') continue
      if (g.share < 0.15 && (g.medianPerf ?? 0) >= WORKING && g.count >= 2) {
        opportunity.push({
          text: `${describeGroup(dim, g)}은(는) ${g.count}번만 썼지만 반응이 평소의 ${fmtRatio(g.medianPerf!)}배였습니다.`,
          evidence: `${evidence(g)} — 표본이 적어 추가 검증 필요`,
          confidence: 'weak',
        })
      }
    }
  }

  return {
    working,
    notWorking,
    viralPattern,
    opportunity: opportunity.slice(0, 5),
    ideas: buildIdeas(posts, dims, lifts),
    limitations,
  }
}

function buildIdeas(posts: AnalyzedPost[], dims: Dimension[], lifts: ViralLift[]): Insights['ideas'] {
  const ideas: Insights['ideas'] = []
  const best = (id: Dimension['id'], exclude: string[] = []) =>
    dims
      .find((d) => d.id === id)
      ?.groups.filter((g) => g.count >= MIN_GROUP && g.medianPerf !== null && g.pBetter < P_WEAK && !exclude.includes(g.key))
      .sort((a, b) => (b.medianPerf ?? 0) - (a.medianPerf ?? 0))[0]

  const ranked = [...posts].filter((p) => p.viral.score !== null).sort((a, b) => b.viral.score! - a.viral.score!)
  const top = ranked[0]
  const second = ranked[1]
  const snippet = (p: AnalyzedPost) => {
    const s = p.features.firstLine || (p.caption ?? '').slice(0, 40)
    return s ? `"${s.slice(0, 40)}${s.length > 40 ? '…' : ''}"` : '(캡션 없음)'
  }

  if (top) {
    ideas.push({
      title: `최고 성과 게시물 ${snippet(top)}의 후속편 (${FORMAT_LABEL[formatGroup(top.format)]}, ${top.features.contentType})`,
      why: `기간 내 Viral Score 1위(${top.viral.score}점). ${top.viral.reasons[0] ?? ''}. 같은 형식과 주제로 각도를 바꿔 재현성을 확인하세요.`,
    })
  }

  const fmt = best('format')
  const type = best('contentType', ['분류 불가'])
  if (fmt && type) {
    ideas.push({
      title: `${fmt.key} × ${type.key} 조합을 늘리기`,
      why: `${fmt.key}은(는) 성과지수 중앙값 ${fmtRatio(fmt.medianPerf!)}배(${fmt.count}개), "${type.key}"은(는) ${fmtRatio(type.medianPerf!)}배(${type.count}개)로 각 축에서 가장 높았습니다.`,
    })
  }

  const hook = best('hook', ['캡션 없음', '서술형 시작'])
  if (hook && (hook.medianPerf ?? 0) >= 1) {
    ideas.push({
      title: `첫 줄을 "${hook.key}"으로 여는 게시물`,
      why: `이 훅으로 시작한 ${hook.count}개 게시물의 성과지수 중앙값이 ${fmtRatio(hook.medianPerf!)}배였습니다.`,
    })
  }

  const cta = best('cta', ['없음'])
  if (cta && (cta.medianPerf ?? 0) >= 1) {
    ideas.push({
      title: `"${cta.key}" CTA를 캡션 마지막에 명시`,
      why: `이 CTA가 있는 ${cta.count}개 게시물은 평소의 ${fmtRatio(cta.medianPerf!)}배 반응을 얻었습니다.`,
    })
  }

  const lift = lifts[0]
  if (lift) {
    ideas.push({
      title: `바이럴 공통 요소 "${lift.value}"을(를) 의도적으로 반복`,
      why: `바이럴 ${lift.viralTotal}개 중 ${lift.viralCount}개가 이 요소를 가졌습니다(전체 비중 ${pct(lift.overallShare)} → 바이럴 비중 ${pct(lift.viralShare)}).`,
    })
  }

  if (second && ideas.length < 5) {
    ideas.push({
      title: `2위 게시물 ${snippet(second)}의 주제를 다른 형식으로 재가공`,
      why: `Viral Score ${second.viral.score}점. 현재 ${FORMAT_LABEL[formatGroup(second.format)]} 형식이므로 다른 형식으로 옮겨 반응 차이를 비교해 보세요.`,
    })
  }

  const weekday = best('weekday')
  if (weekday && ideas.length < 5 && (weekday.medianPerf ?? 0) >= WORKING) {
    ideas.push({
      title: `${weekday.key} 게시 테스트`,
      why: `${weekday.key}에 올린 ${weekday.count}개 게시물의 성과지수 중앙값이 ${fmtRatio(weekday.medianPerf!)}배였습니다. 요일 효과는 우연일 수 있어 몇 주간 확인이 필요합니다.`,
    })
  }

  return ideas.slice(0, 5)
}

function pctP(p: number): string {
  return p < 0.001 ? '0.1% 미만' : `${(p * 100).toFixed(p < 0.01 ? 1 : 0)}%`
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}
