import { useState } from 'react'
import type { AnalyzedPost } from '../analytics/types'
import { FORMAT_LABEL } from '../analytics/types'
import { fmtDate, fmtNum, fmtPct, truncate } from '../lib/format'
import { Badge, Icon, cx } from './ui'

export function Thumb({ post, className }: { post: AnalyzedPost; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!post.thumbnailUrl || failed) {
    return (
      <div className={cx('flex items-center justify-center bg-surface-2 text-xs text-ink-3', className)}>
        {FORMAT_LABEL[post.format]}
        <span className="sr-only"> — 썸네일 없음</span>
      </div>
    )
  }
  return (
    <img
      src={post.thumbnailUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cx('bg-surface-2 object-cover', className)}
    />
  )
}

export function ScorePill({ score, provisional }: { score: number | null; provisional?: boolean }) {
  if (score === null) return <span className="text-xs text-ink-3">점수 없음</span>
  const tone = score >= 70 ? 'text-accent-text bg-accent-soft' : 'text-ink-2 bg-surface-2'
  return (
    <span
      className={cx('tabular inline-flex items-baseline gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold', tone)}
      title={provisional ? '게시 후 3일이 지나지 않아 점수가 바뀔 수 있습니다' : undefined}
    >
      {score}
      <span className="font-normal opacity-70">/100{provisional ? '*' : ''}</span>
    </span>
  )
}

export function PostCard({
  post,
  selectable,
  selected,
  onToggle,
  showReasons = true,
}: {
  post: AnalyzedPost
  selectable?: boolean
  selected?: boolean
  onToggle?: () => void
  showReasons?: boolean
}) {
  const metrics: [string, string][] = [
    ['Likes', post.likeCount === null ? '숨김' : fmtNum(post.likeCount)],
    ['Comments', fmtNum(post.commentsCount)],
  ]
  if (post.format === 'REELS' || post.format === 'VIDEO') metrics.push(['Views', fmtNum(post.viewCount)])
  metrics.push(['ER', fmtPct(post.engagementRate, 2)])

  return (
    <article
      className={cx(
        'flex flex-col overflow-hidden rounded-xl border bg-surface transition-shadow',
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-line',
      )}
    >
      <div className="relative">
        <Thumb post={post} className={post.thumbnailUrl ? 'aspect-square w-full' : 'h-20 w-full'} />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {post.badges.map((b) => (
            <Badge key={b} kind={b} />
          ))}
        </div>
        {selectable && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            aria-label={selected ? '비교에서 빼기' : '비교에 추가'}
            className={cx(
              'absolute top-2 right-2 flex size-8 items-center justify-center rounded-md border text-xs font-medium shadow-sm',
              selected ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface/90 text-ink-2 hover:text-ink',
            )}
          >
            {selected ? <Icon name="check" /> : <Icon name="compare" />}
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
          <span>
            <span className="font-medium text-ink-2">{FORMAT_LABEL[post.format]}</span> · {fmtDate(post.timestamp)}
          </span>
          <ScorePill score={post.viral.score} provisional={post.viral.provisional} />
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink">{truncate(post.caption, 140) || <span className="text-ink-3">캡션 없음</span>}</p>
        <dl className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-2.5">
          {metrics.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] text-ink-3">{k}</dt>
              <dd className="tabular truncate text-sm font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {showReasons && post.viral.reasons.length > 0 && (
          <ul className="space-y-0.5 text-xs text-ink-2">
            {post.viral.reasons.slice(0, 3).map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3" />
                {r}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-ink-3">
          <span className="truncate">
            {post.features.contentType} · {post.features.hook}
          </span>
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 font-medium text-accent-text hover:underline"
            >
              원본 <Icon name="external" className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
