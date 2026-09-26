import { useMemo, useState } from 'react'
import type { AnalyzedPost, AccountAnalysis, Badge } from '../../analytics/types'
import { PostCard } from '../../components/PostCard'
import { Empty, Segmented } from '../../components/ui'
import { VIRAL_CONFIG } from '../../analytics/viralScore'

export type SortKey = 'score' | 'likes' | 'comments' | 'views' | 'er' | 'newest'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'score', label: 'Viral Score' },
  { id: 'likes', label: 'Likes' },
  { id: 'comments', label: 'Comments' },
  { id: 'views', label: 'Views' },
  { id: 'er', label: 'Engagement' },
  { id: 'newest', label: 'Newest' },
]

export function sortPosts(posts: AnalyzedPost[], key: SortKey): AnalyzedPost[] {
  const v = (p: AnalyzedPost): number => {
    switch (key) {
      case 'score':
        return p.viral.score ?? -1
      case 'likes':
        return p.likeCount ?? -1
      case 'comments':
        return p.commentsCount ?? -1
      case 'views':
        return p.viewCount ?? -1
      case 'er':
        return p.engagementRate ?? p.viral.performanceIndex ?? -1
      case 'newest':
        return new Date(p.timestamp).getTime()
    }
  }
  return [...posts].sort((a, b) => v(b) - v(a))
}

interface GridProps {
  posts: AnalyzedPost[]
  compareIds: string[]
  onToggleCompare: (id: string) => void
}

function PostGrid({ posts, compareIds, onToggleCompare }: GridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} selectable selected={compareIds.includes(p.id)} onToggle={() => onToggleCompare(p.id)} />
      ))}
    </div>
  )
}

export function ViralTab({ a, ...grid }: { a: AccountAnalysis } & Omit<GridProps, 'posts'>) {
  const [sort, setSort] = useState<SortKey>('score')
  const viral = useMemo(() => sortPosts(a.posts.filter((p) => p.viral.isViral), sort), [a.posts, sort])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-2">
          바이럴 게시물 <b className="tabular text-ink">{viral.length}개</b>
          <span className="text-ink-3">
            {' '}
            · 기준: Viral Score {VIRAL_CONFIG.viralMinScore}점 이상 & 한 지표 이상이 계정 중앙값의 {VIRAL_CONFIG.viralMinRatio}배 이상
          </span>
        </p>
        <Segmented label="정렬" value={sort} options={SORTS} onChange={setSort} />
      </div>
      {viral.length === 0 ? (
        <Empty title="이 기간에는 바이럴 기준을 넘은 게시물이 없습니다.">
          {a.posts.length < VIRAL_CONFIG.minPostsForViral
            ? `게시물이 ${a.posts.length}개뿐이라 평균 대비 판정을 하지 않았습니다. 기간을 늘려 보세요.`
            : '반응이 고르게 나오는 계정이거나 기간이 짧을 수 있습니다. Posts 탭에서 점수가 높은 순으로 볼 수 있습니다.'}
        </Empty>
      ) : (
        <PostGrid posts={viral} {...grid} />
      )}
    </div>
  )
}

type Filter = 'selected' | Badge | 'all'

export function PostsTab({ a, ...grid }: { a: AccountAnalysis } & Omit<GridProps, 'posts'>) {
  const [sort, setSort] = useState<SortKey>('score')
  const [filter, setFilter] = useState<Filter>('selected')
  const list = useMemo(() => {
    const base =
      filter === 'selected' ? a.selected : filter === 'all' ? a.posts : a.selected.filter((p) => p.badges.includes(filter))
    return sortPosts(base, sort)
  }, [a, filter, sort])

  const filters: { id: Filter; label: string }[] = [
    { id: 'selected', label: `대표 ${a.selected.length}` },
    { id: 'VIRAL', label: 'Viral' },
    { id: 'HIGH ENGAGEMENT', label: 'High Eng.' },
    { id: 'RECENT', label: 'Recent' },
    { id: 'REPRESENTATIVE', label: 'Representative' },
    { id: 'all', label: `전체 ${a.posts.length}` },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Segmented label="필터" value={filter} options={filters} onChange={setFilter} />
        <Segmented label="정렬" value={sort} options={SORTS} onChange={setSort} />
      </div>
      <p className="text-xs text-ink-3">
        대표 게시물은 바이럴 → 참여도 → 최근 → 대표 형식 → 형식 다양성 순서로 섞어 최대 20개를 고릅니다. 카드 오른쪽 위 버튼으로 2~4개를 골라 비교할 수 있습니다.
      </p>
      {list.length === 0 ? <Empty title="조건에 맞는 게시물이 없습니다." /> : <PostGrid posts={list} {...grid} />}
    </div>
  )
}
