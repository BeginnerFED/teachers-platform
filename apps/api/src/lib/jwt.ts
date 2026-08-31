import { createRemoteJWKSet, jwtVerify } from 'jose'
import { z } from 'zod'
import { env } from '../env'
import { UnauthorizedError } from '../http/errors'

const JWKS_URL = new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)

/**
 * This project's Supabase instance signs access tokens with ES256, so the public key is
 * published and verification is arithmetic on this machine — no call to Supabase, no
 * ~110ms of Frankfurt latency on every authenticated request. jose caches the key set
 * and refuses to refetch more than once per cooldown, so a burst of bad tokens cannot
 * turn into a burst of outbound requests.
 */
const jwks = createRemoteJWKSet(JWKS_URL, {
  cooldownDuration: 30_000,
  cacheMaxAge: 10 * 60_000,
})

const accessTokenClaims = z.object({
  sub: z.string().min(1),
  email: z.email().optional(),
  session_id: z.string().optional(),
})

export type AccessTokenClaims = z.infer<typeof accessTokenClaims>

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
      clockTolerance: 5,
    })

    return accessTokenClaims.parse(payload)
  } catch (cause) {
    // Expired, tampered with, signed by someone else, wrong audience — the caller learns
    // only that it did not work. Which of those it was goes to the log, not the response.
    throw new UnauthorizedError('Invalid or expired access token', undefined, { cause })
  }
}

/**
 * Called once at boot. Pays the key fetch before the first real request, and turns
 * "asymmetric keys got switched off" into a startup crash rather than a 500 in production.
 */
export async function warmJwks(): Promise<number> {
  const response = await fetch(JWKS_URL)

  if (!response.ok) {
    throw new Error(`Could not fetch JWKS from Supabase: HTTP ${response.status}`)
  }

  const body = (await response.json()) as { keys?: unknown[] }
  const count = body.keys?.length ?? 0

  if (count === 0) {
    throw new Error(
      'Supabase published no JWKS keys. Asymmetric JWT signing keys must be enabled for this project.',
    )
  }

  return count
}
