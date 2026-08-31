import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../http/context'
import { UnauthorizedError } from '../http/errors'
import { verifyAccessToken } from '../lib/jwt'
import { identityRepository } from '../modules/identity/identity.repository'

const BEARER = /^bearer\s+(.+)$/i

/**
 * Establishes who is calling. Two steps, and the order matters: the token's signature is
 * checked first, offline, so an unsigned request never reaches the database at all.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = BEARER.exec(c.req.header('authorization') ?? '')?.[1]?.trim()

  if (!token) {
    throw new UnauthorizedError('Missing bearer token')
  }

  const claims = await verifyAccessToken(token)

  // The role comes from the profiles table, never from a claim inside the token. A token
  // minted before someone was demoted would otherwise keep granting what it granted then.
  const profile = await identityRepository.findProfileById(claims.sub)

  if (!profile) {
    throw new UnauthorizedError('This account has no profile')
  }

  c.set('auth', {
    userId: profile.id,
    email: profile.email,
    role: profile.role,
    token,
  })

  await next()
})
