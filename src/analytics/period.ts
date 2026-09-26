export type Period = '1m' | '3m' | '6m' | '12m' | 'all'

export const PERIODS: { id: Period; label: string; months: number | null }[] = [
  { id: '1m', label: '최근 1개월', months: 1 },
  { id: '3m', label: '최근 3개월', months: 3 },
  { id: '6m', label: '최근 6개월', months: 6 },
  { id: '12m', label: '최근 12개월', months: 12 },
  { id: 'all', label: '전체 수집 가능 기간', months: null },
]

export const DEFAULT_PERIOD: Period = '6m'

export function isPeriod(v: string | null | undefined): v is Period {
  return PERIODS.some((p) => p.id === v)
}

export function periodSince(period: Period, now: Date = new Date()): Date | null {
  const months = PERIODS.find((p) => p.id === period)?.months
  if (!months) return null
  const d = new Date(now)
  d.setMonth(d.getMonth() - months)
  return d
}

export function periodLabel(period: Period): string {
  return PERIODS.find((p) => p.id === period)?.label ?? period
}
