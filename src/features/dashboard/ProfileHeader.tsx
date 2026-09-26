import { useState } from 'react'
import { periodLabel } from '../../analytics/period'
import type { AccountAnalysis } from '../../analytics/types'
import { Tag } from '../../components/ui'
import { fmtDate, fmtDateTime, fmtNum } from '../../lib/format'

export function ProfileHeader({ a }: { a: AccountAnalysis }) {
  const p = a.dataset.profile
  const [imgFailed, setImgFailed] = useState(false)
  const stats: [string, string][] = [
    ['Followers', fmtNum(p.followersCount)],
    ['Following', fmtNum(p.followsCount)],
    ['Posts', fmtNum(p.mediaCount)],
    ['분석한 게시물', `${a.overview.analyzedCount}개`],
  ]
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 gap-4">
        {p.profilePictureUrl && !imgFailed ? (
          <img
            src={p.profilePictureUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="size-16 shrink-0 rounded-full border border-line bg-surface-2 object-cover sm:size-20"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl font-semibold text-ink-3 uppercase sm:size-20">
            {p.username.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">@{p.username}</h1>
            {a.category.category ? (
              <span title={a.category.basis}>
                <Tag>{a.category.category} · 추정</Tag>
              </span>
            ) : (
              <span title={a.category.basis}>
                <Tag>카테고리 알 수 없음</Tag>
              </span>
            )}
          </div>
          {p.name && <div className="mt-0.5 text-sm text-ink-2">{p.name}</div>}
          {p.biography && <p className="mt-2 line-clamp-3 max-w-xl text-sm whitespace-pre-line text-ink-2">{p.biography}</p>}
          <a
            href={`https://www.instagram.com/${p.username}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-medium text-accent-text hover:underline"
          >
            instagram.com/{p.username}
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {stats.map(([k, v]) => (
            <div key={k} className="bg-surface px-3 py-2">
              <dt className="truncate text-[10px] tracking-wide text-ink-3 uppercase">{k}</dt>
              <dd className="tabular text-sm font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs lg:text-right">
          <dt className="text-ink-3">Data Source</dt>
          <dd className="font-medium text-ink">{a.dataset.source.label}</dd>
          <dt className="text-ink-3">Last Updated</dt>
          <dd className="tabular text-ink-2">{fmtDateTime(a.dataset.source.fetchedAt)}</dd>
          <dt className="text-ink-3">분석 기간</dt>
          <dd className="tabular text-ink-2">
            {periodLabel(a.period)} ({a.periodStart ? `${fmtDate(a.periodStart)} ~ ` : '~ '}
            {fmtDate(a.periodEnd)})
          </dd>
          <dt className="text-ink-3">분석 날짜</dt>
          <dd className="tabular text-ink-2">{fmtDateTime(a.analyzedAt)}</dd>
        </dl>
      </div>
    </div>
  )
}

export function DataNotes({ a }: { a: AccountAnalysis }) {
  const notes = [...a.dataset.source.notes.filter((n) => !n.startsWith('파일:'))]
  if (!a.periodCoverage.complete && a.periodStart) {
    notes.push(
      `선택한 기간 전체를 수집하지 못했습니다. 가장 오래된 수집 게시물은 ${fmtDate(a.periodCoverage.oldestPost)}입니다.`,
    )
  }
  if (a.overview.likesHiddenCount > 0) notes.push(`좋아요 수를 숨긴 게시물이 ${a.overview.likesHiddenCount}개 있습니다.`)
  if (a.overview.metricCoverage.videos > 0 && a.overview.metricCoverage.views === 0) {
    notes.push('이 데이터에는 영상 조회수가 없어 Viral Score에서 조회수를 제외했습니다.')
  }
  if (a.dataset.profile.followersCount === null) notes.push('팔로워 수가 없어 참여율(ER)은 계산하지 않았습니다.')
  if (notes.length === 0) return null
  return (
    <ul className="space-y-1 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  )
}
