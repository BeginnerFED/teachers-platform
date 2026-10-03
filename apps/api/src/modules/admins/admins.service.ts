import type { AdminListItem, InvitedAdmin } from '@tp/shared'
import { ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors'
import { accountsService, type AccountsService } from '../accounts/accounts.service'
import { adminsRepository, type AdminProfileRow, type AdminsRepository } from './admins.repository'

export type AdminsServiceDeps = {
  admins: AdminsRepository
  /** Making the account is the same job here as for a teacher or a student. */
  accounts: Pick<AccountsService, 'create'>
}

export function createAdminsService({ admins, accounts }: AdminsServiceDeps) {
  async function toListItem(row: AdminProfileRow, viewerId: string): Promise<AdminListItem> {
    const auth = await admins.getAuthInfo(row.id)

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      createdAt: row.created_at,
      lastSignInAt: auth?.lastSignInAt ?? null,
      invitePending: auth?.lastSignInAt == null,
      isSelf: row.id === viewerId,
    }
  }

  return {
    async list(viewerId: string): Promise<AdminListItem[]> {
      const rows = await admins.listProfiles()

      // One auth lookup each. There are a handful of administrators, not a directory, so
      // this stays cheaper and simpler than paging the whole user list to filter it.
      return Promise.all(rows.map((row) => toListItem(row, viewerId)))
    },

    async invite({
      email,
      fullName,
      actorId,
    }: {
      email: string
      fullName: string
      actorId: string
    }): Promise<InvitedAdmin> {
      const created = await accounts.create({ email, fullName }, 'admin')

      const rows = await admins.listProfiles()
      const row = rows.find((candidate) => candidate.id === created.id)
      if (!row) throw new NotFoundError('The new administrator could not be read back')

      return {
        admin: await toListItem(row, actorId),
        temporaryPassword: created.temporaryPassword,
      }
    },

    /**
     * Taking the role away rather than deleting the account: an administrator has a
     * history, and destroying it to revoke a permission is a trade nobody asked for.
     * They become an ordinary teacher, which is what the platform's other accounts are.
     */
    async revoke({ adminId, actorId }: { adminId: string; actorId: string }): Promise<void> {
      // Refused up front because it is the mistake people actually make. It does not keep
      // an administrator in place on its own: two administrators removing each other at
      // the same moment are each removing somebody else. demote() is what guarantees one
      // remains, because it checks and writes in a single step.
      if (adminId === actorId) {
        throw new RuleViolationError('You cannot remove your own administrator access')
      }

      const outcome = await admins.demote(adminId, actorId)

      if (outcome === 'not_found') throw new NotFoundError('No such account')
      if (outcome === 'not_admin') {
        throw new RuleViolationError('That account is not an administrator')
      }
      if (outcome === 'forbidden') throw new ForbiddenError('You are no longer an administrator')
      if (outcome === 'last_admin') {
        throw new RuleViolationError('The last administrator cannot be removed')
      }
    },
  }
}

export type AdminsService = ReturnType<typeof createAdminsService>

export const adminsService = createAdminsService({
  admins: adminsRepository,
  accounts: accountsService,
})
