import type { Context } from 'hono'
import type { Enums } from '@tp/shared'
import type { Logger } from '../lib/logger'
import { UnauthorizedError } from './errors'

/** Who is making this request, established by the requireAuth middleware. */
export type AuthContext = {
  userId: string
  email: string
  role: Enums<'user_role'>
  /** The caller's raw access token, for the rare query that should run under their RLS. */
  token: string
}

export type AppEnv = {
  Variables: {
    requestId: string
    log: Logger
    auth: AuthContext
  }
}

/**
 * `auth` is declared non-optional so handlers can read `getAuth(c).userId` without
 * narrowing, which is worth one runtime check: TypeScript cannot express "this exists
 * only downstream of that middleware" without splitting the environment in two, and the
 * ceremony costs more than it buys. A handler mounted without requireAuth fails here,
 * loudly, rather than reading undefined and carrying on.
 */
export function getAuth(c: Context<AppEnv>): AuthContext {
  const auth = c.get('auth')

  if (!auth) {
    throw new UnauthorizedError('This route is missing its authentication middleware')
  }

  return auth
}
