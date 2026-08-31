import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type MeProfile,
  type UpdateMeBody,
} from '@tp/shared'
import { NotFoundError } from '../../http/errors'
import {
  identityRepository,
  type IdentityRepository,
  type ProfileRow,
} from './identity.repository'

/** The column is plain text; the dictionary is the thing that decides what is supported. */
function toLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE
}

function toMeProfile(row: ProfileRow): MeProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    locale: toLocale(row.locale),
    createdAt: row.created_at,
  }
}

export type IdentityServiceDeps = {
  identity: IdentityRepository
}

export function createIdentityService({ identity }: IdentityServiceDeps) {
  return {
    async updateMe({ userId, body }: { userId: string; body: UpdateMeBody }): Promise<MeProfile> {
      const patch: Parameters<IdentityRepository['updateProfile']>[1] = {}

      if (body.fullName !== undefined) patch.full_name = body.fullName
      if (body.locale !== undefined) patch.locale = body.locale

      const row = await identity.updateProfile(userId, patch)

      // The caller's own row, and they just proved they exist by authenticating, so this
      // means the account was deleted mid-request rather than that they asked for someone
      // else's profile.
      if (!row) throw new NotFoundError('Your profile no longer exists')

      return toMeProfile(row)
    },
  }
}

export type IdentityService = ReturnType<typeof createIdentityService>

export const identityService = createIdentityService({ identity: identityRepository })
