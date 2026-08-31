import { z } from 'zod'

/**
 * Shared by every list endpoint. The API validates incoming query strings with it and
 * the web app parses with the same schema, so the two can never disagree about what a
 * valid page looks like.
 */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export type PaginationQuery = z.infer<typeof paginationQuery>

export type PageMeta = {
  page: number
  perPage: number
  total: number
}

/** Postgres range bounds are inclusive on both ends, which is easy to get wrong. */
export function pageRange({ page, perPage }: PaginationQuery) {
  const from = (page - 1) * perPage

  return { from, to: from + perPage - 1 }
}
