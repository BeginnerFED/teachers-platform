import { describe, expect, it } from 'vitest'
import { searchPattern } from './search'

describe('PostgREST search patterns', () => {
  it('preserves a complete email address instead of replacing its dots with spaces', () => {
    expect(searchPattern('  jane.doe@example.com  ')).toBe('"%jane.doe@example.com%"')
  })

  it('keeps filter delimiters inside one quoted value', () => {
    expect(searchPattern('Travel (A2), part 1')).toBe('"%Travel (A2), part 1%"')
    expect(searchPattern('x",role.eq.admin)')).toBe(String.raw`"%x\",role.eq.admin)%"`)
  })

  it('escapes LIKE wildcards and backslashes before escaping the filter grammar', () => {
    expect(searchPattern('100%_done')).toBe(String.raw`"%100\\%\\_done%"`)
    expect(searchPattern(String.raw`a\b`)).toBe(String.raw`"%a\\\\b%"`)
  })
})
