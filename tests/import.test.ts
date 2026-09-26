import { describe, expect, it } from 'vitest'
import { parseImport, ImportError, parseCount } from '../src/features/import/parseImport'

const MOD = new Date('2026-09-20T00:00:00Z')

describe('parseImport CSV', () => {
  const csv = [
    'permalink,timestamp,media_type,caption,like_count,comments_count,view_count',
    'https://www.instagram.com/reel/ABC/,2026-09-01T10:00:00Z,REELS,"Hello, ""world""",1.2K,30,15000',
    'https://www.instagram.com/p/DEF/,2026-08-01,CAROUSEL_ALBUM,"multi\nline",500,,',
    'bad,notadate,IMAGE,x,1,1,',
  ].join('\n')

  it('parses rows, keeps missing metrics null, skips bad dates', () => {
    const ds = parseImport(csv, 'posts.csv', MOD, { username: '@Brand', followersCount: 5000 })
    expect(ds.profile.username).toBe('brand')
    expect(ds.media).toHaveLength(2)
    const [reel, carousel] = ds.media
    expect(reel).toMatchObject({ id: 'ABC', format: 'REELS', likeCount: 1200, viewCount: 15000, caption: 'Hello, "world"' })
    expect(carousel).toMatchObject({ format: 'CAROUSEL', commentsCount: null, viewCount: null })
    expect(ds.source.kind).toBe('imported')
    expect(ds.source.notes.join()).toContain('1개는 제외')
  })

  it('requires a username', () => {
    expect(() => parseImport(csv, 'posts.csv', MOD, {})).toThrow(ImportError)
  })
})

describe('parseImport JSON', () => {
  it('accepts raw Graph API business_discovery output', () => {
    const graph = {
      business_discovery: {
        username: 'bluebottle',
        followers_count: 1000,
        media: {
          data: [
            { id: '1', timestamp: '2026-09-01T00:00:00+0000', media_type: 'VIDEO', media_product_type: 'REELS', like_count: 10, comments_count: 1, view_count: 99 },
            { id: '2', timestamp: '2026-08-01T00:00:00+0000', media_type: 'IMAGE', comments_count: 3 },
          ],
        },
      },
      id: '1784',
    }
    const ds = parseImport(JSON.stringify(graph), 'bd.json', MOD, {})
    expect(ds.profile.username).toBe('bluebottle')
    expect(ds.profile.followersCount).toBe(1000)
    expect(ds.media[0]).toMatchObject({ format: 'REELS', viewCount: 99 })
    expect(ds.media[1]).toMatchObject({ format: 'IMAGE', likeCount: null })
    expect(ds.source.label).toContain('Graph')
  })

  it('accepts the native format and rejects unknown shapes', () => {
    const native = {
      exportedAt: '2026-09-25T08:00:00Z',
      profile: { username: 'x', followersCount: 10 },
      media: [{ id: 'a', timestamp: '2026-09-01T00:00:00Z', format: 'IMAGE', likeCount: 1, commentsCount: 0 }, { id: 'b' }],
    }
    const ds = parseImport(JSON.stringify(native), 'x.json', MOD, {})
    expect(ds.media).toHaveLength(1)
    expect(ds.source.fetchedAt).toBe('2026-09-25T08:00:00Z')
    expect(() => parseImport('{"foo":1}', 'y.json', MOD, { username: 'y' })).toThrow(ImportError)
  })
})

it('parseCount', () => {
  expect(parseCount('1,234')).toBe(1234)
  expect(parseCount('2.5M')).toBe(2_500_000)
  expect(parseCount('3만')).toBe(30000)
  expect(parseCount('')).toBeNull()
  expect(parseCount('n/a')).toBeNull()
})
