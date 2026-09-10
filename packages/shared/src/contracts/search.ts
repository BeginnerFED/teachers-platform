import { z } from 'zod'
import type { Correspondent } from './messaging'
import type { MaterialListItem } from './materials'

export const SEARCH_LIMIT = 5
export const searchQuery = z.object({ query: z.string().trim().min(2).max(120) })
export type SearchQuery = z.infer<typeof searchQuery>

/** Search exposes summaries only; opening a result checks its current permissions again. */
export type SearchResults = {
  materials: Pick<MaterialListItem, 'id' | 'title' | 'level' | 'description'>[]
  people: Correspondent[]
}

export function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i').trim()
}
