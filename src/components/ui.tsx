import type { ReactNode } from 'react'
import type { Badge as BadgeKind } from '../analytics/types'

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ')
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <div className="truncate text-xs text-ink-3">{label}</div>
      <div className="tabular mt-1 truncate text-xl font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>}
    </div>
  )
}

const BADGE_STYLE: Record<BadgeKind, string> = {
  VIRAL: 'bg-accent text-white',
  'HIGH ENGAGEMENT': 'bg-accent-soft text-accent-text',
  RECENT: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
  REPRESENTATIVE: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
}

export function Badge({ kind }: { kind: BadgeKind }) {
  return (
    <span className={cx('inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold tracking-wide', BADGE_STYLE[kind])}>
      {kind}
    </span>
  )
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'good' }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    warn: 'bg-warn-soft text-warn',
    good: 'bg-good-soft text-good',
  }
  return <span className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-xs', tones[tone])}>{children}</span>
}

export function Button({
  children,
  variant = 'secondary',
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const v = {
    primary: 'bg-ink text-bg hover:opacity-90 disabled:opacity-40',
    secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2 disabled:opacity-40',
    ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  }[variant]
  return (
    <button
      type="button"
      className={cx('inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors', v, className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="scrollbar-none flex max-w-full overflow-x-auto rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={cx(
            'h-7 shrink-0 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
            o.id === value ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-3 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <div className="mt-1 text-xs text-ink-3">{children}</div>}
    </div>
  )
}

export function Confidence({ level }: { level: 'strong' | 'weak' | 'insufficient' }) {
  if (level === 'strong') return <Tag tone="good">근거 충분</Tag>
  if (level === 'weak') return <Tag tone="warn">참고 수준</Tag>
  return <Tag>표본 부족</Tag>
}

export function Icon({ name, className = 'size-4' }: { name: 'search' | 'x' | 'arrow-left' | 'external' | 'upload' | 'check' | 'info' | 'compare'; className?: string }) {
  const paths: Record<string, ReactNode> = {
    search: <path d="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    'arrow-left': <path d="M19 12H5m7-7-7 7 7 7" />,
    external: <path d="M14 4h6v6m0-6L10 14m-4-8H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1" />,
    upload: <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
    check: <path d="M5 12.5 10 17 19 7" />,
    info: <path d="M12 16v-5m0-3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    compare: <path d="M8 3v18M16 3v18M3 8h5m8 0h5M3 16h5m8 0h5" />,
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
