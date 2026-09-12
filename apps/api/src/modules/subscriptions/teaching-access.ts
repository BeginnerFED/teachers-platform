import { AppError, NotFoundError } from '../../http/errors'
import { identityRepository } from '../identity/identity.repository'
import { subscriptionsRepository } from './subscriptions.repository'
import { toTeacherSubscription } from './subscriptions.mapper'

export async function teachingAccess(profileId: string) {
  const row = await subscriptionsRepository.findByProfileId(profileId)
  return row ? toTeacherSubscription(row, new Date()) : null
}

export async function assertTeachingAccess(profileId: string) {
  if (!(await teachingAccess(profileId))?.hasAccess) {
    throw new AppError('subscription_required', 403, 'An active teaching subscription is required')
  }
}

/** Public room links must also respect the host's current access. */
export async function assertHostAccess(profileId: string) {
  const profile = await identityRepository.findProfileById(profileId)
  if (profile?.role === 'admin') return
  if (profile?.role !== 'teacher') throw new NotFoundError('This lesson is unavailable')
  await assertTeachingAccess(profileId)
}

/** Keep account support and previous records available after teaching access ends. */
export function requiresTeachingAccess(method: string, path: string) {
  if (/^\/v1\/(conversations|settings)(\/|$)/.test(path) || /^\/v1\/me\/?$/.test(path)) return false
  if (/^\/v1\/live\/[^/]+\/end$/.test(path)) return false
  if (method === 'GET' || method === 'HEAD') {
    return (
      /^\/v1\/(materials|search)(\/|$)/.test(path) ||
      path === '/v1/live/recent-materials' ||
      path === '/v1/assets'
    )
  }
  return true
}
