import type { PostgrestError } from '@supabase/supabase-js'
import { ConflictError, InternalError, NotFoundError } from '../../http/errors'

/**
 * Turns a Postgres failure into something the rest of the API understands. Repositories
 * call this instead of letting a raw driver error escape, so no layer above them has to
 * know what a PostgREST error code looks like.
 */
// The Postgres message goes to `cause`, which is logged, and never to `details`, which
// is serialised into the response — a client has no business reading our column names.
export function throwFromPostgrest(error: PostgrestError, operation: string): never {
  switch (error.code) {
    // No rows where exactly one was required.
    case 'PGRST116':
      throw new NotFoundError(`${operation}: no matching row`, undefined, { cause: error })

    case '23505':
      throw new ConflictError(`${operation}: already exists`, undefined, { cause: error })

    case '23503':
      throw new ConflictError(`${operation}: referenced row is missing`, undefined, {
        cause: error,
      })

    // Permission denied. This project has automatic table exposure turned off, so it
    // almost always means a migration forgot its GRANT — a bug here, not a bad request.
    case '42501':
      throw new InternalError(
        `${operation}: the database refused access. A table grant is probably missing.`,
        { cause: error },
      )

    default:
      throw new InternalError(`${operation}: ${error.message}`, { cause: error })
  }
}
