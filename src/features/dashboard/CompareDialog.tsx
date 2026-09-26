import { useEffect, useRef } from 'react'
import { biggestDifference } from '../../analytics/compare'
import type { AnalyzedPost } from '../../analytics/types'
import { FORMAT_LABEL } from '../../analytics/types'
import { Thumb, ScorePill } from '../../components/PostCard'
import { Icon } from '../../components/ui'
import { fmtDate, fmtNum, fmtPct, truncate } from '../../lib/format'

export function CompareDialog({ posts, onClose }: { posts: AnalyzedPost[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    // No close() in cleanup: it would fire onClose and, under StrictMode's re-run, dismiss the dialog at once.
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const rows: [string, (p: AnalyzedPost) => React.ReactNode][] = [
    ['Format', (p) => FORMAT_LABEL[p.format]],
    ['Date', (p) => fmtDate(p.timestamp)],
    ['Likes', (p) => (p.likeCount === null ? '숨김' : fmtNum(p.likeCount, { compact: false }))],
    ['Comments', (p) => fmtNum(p.commentsCount, { compact: false })],
    ['Views', (p) => fmtNum(p.viewCount, { compact: false })],
    ['Engagement', (p) => fmtPct(p.engagementRate, 2)],
    ['Viral Score', (p) => <ScorePill score={p.viral.score} provisional={p.viral.provisional} />],
    ['Caption length', (p) => `${p.features.captionLength}자`],
    ['CTA', (p) => (p.features.ctas.length ? p.features.ctas.join(', ') : '없음')],
    ['Content Type', (p) => p.features.contentType],
    ['Hook', (p) => p.features.hook],
  ]

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-4xl rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold">게시물 비교 ({posts.length}개)</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="-m-1 p-1 text-ink-3 hover:text-ink">
          <Icon name="x" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr>
              <th className="w-28 p-3" />
              {posts.map((p, i) => (
                <th key={p.id} className="p-3 text-left align-top font-normal">
                  <div className="text-xs font-semibold tracking-wide text-ink-3">POST {String.fromCharCode(65 + i)}</div>
                  <Thumb post={p} className="mt-1.5 aspect-square w-full max-w-36 rounded-md" />
                  <p className="mt-1.5 line-clamp-2 text-xs text-ink-2">{truncate(p.caption, 70) || '캡션 없음'}</p>
                  {p.permalink && (
                    <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent-text hover:underline">
                      원본 <Icon name="external" className="size-3" />
                    </a>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(([label, get]) => (
              <tr key={label} className="border-t border-line">
                <th scope="row" className="p-3 text-left text-xs font-medium text-ink-3">
                  {label}
                </th>
                {posts.map((p) => (
                  <td key={p.id} className="p-3">
                    {get(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line bg-surface-2 px-4 py-3">
        <div className="text-xs font-semibold text-ink-3">가장 큰 차이</div>
        <p className="mt-1 text-sm text-ink">{biggestDifference(posts)}</p>
      </div>
    </dialog>
  )
}
