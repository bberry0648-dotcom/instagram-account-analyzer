const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('en')

export function fmtNum(v: number | null | undefined, opts: { compact?: boolean } = { compact: true }): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  if (opts.compact && Math.abs(v) >= 10_000) return compact.format(v)
  return full.format(Math.round(v))
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return ''
  const chars = [...s.replace(/\s+/g, ' ').trim()]
  return chars.length > n ? `${chars.slice(0, n).join('')}…` : chars.join('')
}
