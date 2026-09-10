import { describe, expect, it } from 'vitest'
import { normalizeSearch, searchQuery } from './search'

describe('search input', () => {
  it.each(['', ' ', 'a', ' a ', 'a'.repeat(121)])('rejects an invalid query (%j)', (query) => {
    expect(searchQuery.safeParse({ query }).success).toBe(false)
  })
  it('trims and allows queries up to the existing list endpoint limit', () => {
    expect(searchQuery.parse({ query: '  lesson  ' })).toEqual({ query: 'lesson' })
    expect(searchQuery.safeParse({ query: 'a'.repeat(120) }).success).toBe(true)
  })
  it('matches composed accents and Turkish casing consistently for pages and contacts', () => {
    expect(normalizeSearch(' İPEK Işıl ')).toBe('ipek isil')
    expect(normalizeSearch('École')).toBe(normalizeSearch('E\u0301cole'))
    expect(normalizeSearch('МАТЕРІАЛИ')).toBe(normalizeSearch('матеріали'))
  })
})
