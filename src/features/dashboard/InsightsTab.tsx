import type { AccountAnalysis, InsightItem } from '../../analytics/types'
import { Confidence, Empty, Section } from '../../components/ui'

function List({ items, empty }: { items: InsightItem[]; empty: string }) {
  if (items.length === 0) return <Empty title={empty} />
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <li key={i.text} className="py-2.5 first:pt-0 last:pb-0">
          <p className="text-sm text-ink">{i.text}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="tabular">{i.evidence}</span>
            <Confidence level={i.confidence} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function InsightsTab({ a }: { a: AccountAnalysis }) {
  const ins = a.insights
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
        아래 인사이트는 이 계정의 {a.overview.analyzedCount}개 게시물 수치만으로 규칙에 따라 계산했습니다(생성형 AI 문장이 아님). 모든 문장에 근거 수치가 붙어
        있고, 3개 미만 그룹은 결론에 쓰지 않습니다.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="What's Working?" description="계정 평소 수준보다 반응이 1.2배 이상 높은 유형">
          <List items={ins.working} empty="평소보다 뚜렷하게 잘되는 유형을 찾지 못했습니다." />
        </Section>
        <Section title="What's Not Working?" description="계정 평소 수준의 0.8배 이하인 유형">
          <List items={ins.notWorking} empty="평소보다 뚜렷하게 약한 유형이 없습니다." />
        </Section>
        <Section title="Viral Pattern" description="바이럴 게시물의 공통점">
          <List items={ins.viralPattern} empty="바이럴 게시물의 공통점을 뽑을 만큼 표본이 없습니다." />
        </Section>
        <Section title="Content Opportunity" description="많이 쓰지 않았지만 시도해 볼 만한 것">
          <List items={ins.opportunity} empty="데이터상 뚜렷한 기회 영역이 없습니다." />
        </Section>
      </div>
      <Section title="Next Content Ideas" description="분석 결과에서 나온 다음 콘텐츠 제안">
        {ins.ideas.length === 0 ? (
          <Empty title="제안을 만들 만큼 데이터가 충분하지 않습니다." />
        ) : (
          <ol className="flex flex-col gap-3">
            {ins.ideas.map((idea, i) => (
              <li key={idea.title} className="flex gap-3">
                <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold text-ink-2">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{idea.title}</p>
                  <p className="mt-0.5 text-xs text-ink-2">{idea.why}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="분석 한계">
        <ul className="list-disc space-y-1 pl-4 text-xs text-ink-2">
          {ins.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
