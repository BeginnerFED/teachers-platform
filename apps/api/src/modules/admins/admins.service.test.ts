import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../http/errors'
import type { AdminsRepository, DemotionOutcome } from './admins.repository'
import { createAdminsService } from './admins.service'

function service(outcome: DemotionOutcome = 'demoted') {
  const admins: AdminsRepository = {
    listProfiles: vi.fn(),
    getAuthInfo: vi.fn(),
    demote: vi.fn().mockResolvedValue(outcome),
  }

  return { admins, service: createAdminsService({ admins, accounts: { create: vi.fn() } }) }
}

describe('revoking an administrator', () => {
  it('demotes somebody else through the one guarded database call', async () => {
    const { admins, service: subject } = service()

    await expect(subject.revoke({ adminId: 'other', actorId: 'me' })).resolves.toBeUndefined()
    expect(admins.demote).toHaveBeenCalledWith('other', 'me')
  })

  it('refuses self-removal without reaching the database', async () => {
    const { admins, service: subject } = service()

    await expect(subject.revoke({ adminId: 'me', actorId: 'me' })).rejects.toMatchObject({
      code: 'rule_violation',
    })
    expect(admins.demote).not.toHaveBeenCalled()
  })

  // Two administrators removing each other at once: the database applies one demotion and
  // the other arrives from somebody who is no longer an administrator.
  it.each([
    { outcome: 'not_found', code: 'not_found', status: 404 },
    { outcome: 'not_admin', code: 'rule_violation', status: 422 },
    { outcome: 'forbidden', code: 'forbidden', status: 403 },
    { outcome: 'last_admin', code: 'rule_violation', status: 422 },
  ] as const)('answers $outcome with $code', async ({ outcome, code, status }) => {
    const error = await service(outcome)
      .service.revoke({ adminId: 'other', actorId: 'me' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ code, status })
  })
})
