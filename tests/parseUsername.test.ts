import { describe, expect, it } from 'vitest'
import { parseInstagramInput } from '../src/features/instagram/parseUsername'

describe('parseInstagramInput', () => {
  it.each([
    ['https://www.instagram.com/nike/', 'nike'],
    ['https://instagram.com/nike', 'nike'],
    ['instagram.com/Nike?igsh=abc123', 'nike'],
    ['http://m.instagram.com/natgeo/', 'natgeo'],
    ['www.instagram.com/some.creator_01/', 'some.creator_01'],
    ['https://www.instagram.com/stories/nasa/3456/', 'nasa'],
    ['@nike', 'nike'],
    ['  nike  ', 'nike'],
    ['Apple', 'apple'],
  ])('%s → %s', (input, expected) => {
    expect(parseInstagramInput(input)).toEqual({ ok: true, username: expected })
  })

  it.each([
    '',
    'https://www.instagram.com/p/C1abcDEF/',
    'https://www.instagram.com/reel/C1abcDEF/',
    'https://www.instagram.com/',
    'https://twitter.com/nike',
    'nike.com',
    '@bad name',
    '.startsdot',
    'a..b',
    'x'.repeat(31),
    '한글계정',
  ])('rejects %s', (input) => {
    expect(parseInstagramInput(input).ok).toBe(false)
  })
})
