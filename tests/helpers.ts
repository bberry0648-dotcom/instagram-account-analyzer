import type { AccountDataset, MediaFormat, MediaItem } from '../shared/types'

// Synthetic fixtures for unit tests only. Never imported by the app.
export function post(i: number, over: Partial<MediaItem> = {}, now = new Date('2026-09-26T12:00:00Z')): MediaItem {
  const format: MediaFormat = over.format ?? (['REELS', 'CAROUSEL', 'IMAGE'] as const)[i % 3]
  return {
    id: `p${i}`,
    permalink: `https://www.instagram.com/p/p${i}/`,
    timestamp: new Date(now.getTime() - (i + 4) * 86_400_000).toISOString(),
    format,
    caption: `post ${i}`,
    likeCount: 100,
    commentsCount: 10,
    viewCount: format === 'REELS' ? 1000 : null,
    thumbnailUrl: null,
    childrenCount: null,
    ...over,
  }
}

export function dataset(media: MediaItem[], followers: number | null = 10_000): AccountDataset {
  return {
    profile: {
      username: 'test.account',
      name: 'Test',
      biography: null,
      website: null,
      profilePictureUrl: null,
      followersCount: followers,
      followsCount: 1,
      mediaCount: media.length,
    },
    media,
    reachedEnd: true,
    source: { kind: 'imported', label: 'test', fetchedAt: '2026-09-26T00:00:00Z', notes: [] },
  }
}
