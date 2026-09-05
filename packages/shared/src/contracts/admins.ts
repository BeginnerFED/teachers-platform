import { z } from 'zod'
import { createAccountBody } from './accounts'

/** The same two fields every new account needs; only the role differs, and that is fixed. */
export const inviteAdminBody = createAccountBody

export type InviteAdminBody = z.infer<typeof inviteAdminBody>

export const adminIdParam = z.object({
  adminId: z.uuid(),
})

export type AdminListItem = {
  id: string
  email: string
  fullName: string | null
  createdAt: string
  /**
   * True until they follow the invite link and sign in for the first time. An invited
   * admin who never accepted still holds the role, and hiding that is how a list of
   * administrators stops describing who can actually get in.
   */
  invitePending: boolean
  lastSignInAt: string | null
  /** Set on the row belonging to whoever asked, so the UI can refuse to let them remove it. */
  isSelf: boolean
}

export type InvitedAdmin = {
  admin: AdminListItem
  /**
   * Generated on the server, handed back exactly once and never stored anywhere we can
   * read it again. The new admin signs in with it and changes it under Security.
   */
  temporaryPassword: string
}
