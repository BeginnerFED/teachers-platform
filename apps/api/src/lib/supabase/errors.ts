import type { AuthError, PostgrestError } from '@supabase/supabase-js'
import { ConflictError, InternalError, NotFoundError, ValidationError } from '../../http/errors'

/**
 * Storage reports failures as its own class rather than a Postgres or auth error, and which
 * of those classes a given version of the client re-exports has moved around. Described by
 * its shape instead, so an upgrade cannot break this import.
 */
type StorageFailure = { name: string; message: string; status?: number | string }

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

    // An optimistic/serialized domain write lost a race in a database function or trigger.
    case 'TP409':
      throw new ConflictError(`${operation}: the resource changed`, undefined, { cause: error })

    case '22001':
      throw new ValidationError(`${operation}: the value is too large`)

    case '22023':
      throw new ValidationError(`${operation}: an argument is invalid`)

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

/**
 * The same job for Storage, which reports neither Postgres codes nor auth ones — just a
 * name and an HTTP status. Only the two the API can actually cause are named; the rest are
 * our bug or an outage, and both belong in the logs rather than in a message someone reads.
 */
export function throwFromStorage(error: StorageFailure, operation: string): never {
  const status = Number(error.status ?? 0)

  if (status === 404) {
    throw new NotFoundError(`${operation}: no such file`, undefined, { cause: error })
  }

  // The bucket refuses a file that is too large or of the wrong type, which is a rule the
  // API states as well — so reaching this means the two disagree, and that is worth a log.
  if (status === 409) {
    throw new ConflictError(`${operation}: that file is already there`, undefined, { cause: error })
  }

  throw new InternalError(`${operation}: ${error.message}`, { cause: error })
}

/**
 * And once more for the auth admin API, which reports its own codes rather than Postgres
 * ones. Only the two an admin can actually cause are named; everything else is our bug
 * or an outage, and both belong in the logs rather than in a message someone reads.
 */
export function throwFromAuth(error: AuthError, operation: string): never {
  switch (error.code) {
    case 'email_exists':
    case 'user_already_exists':
      throw new ConflictError(`${operation}: that email is already registered`, undefined, {
        cause: error,
      })

    case 'user_not_found':
      throw new NotFoundError(`${operation}: no such user`, undefined, { cause: error })

    default:
      throw new InternalError(`${operation}: ${error.message}`, { cause: error })
  }
}
