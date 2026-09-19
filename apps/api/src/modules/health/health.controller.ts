import { factory } from '../../http/factory'
import { hasAiConfiguration } from '../../env'
import { healthRepository } from './health.repository'

/** Is the process up? Answers without touching anything else, so it stays honest. */
export const liveness = factory.createHandlers((c) => c.json({ data: { status: 'ok' as const } }))

/** Can it actually serve? A load balancer should use this one, not liveness. */
export const readiness = factory.createHandlers(async (c) => {
  await Promise.all([healthRepository.ping(), healthRepository.reminders()])

  return c.json({
    data: {
      status: 'ready' as const,
      features: { ai: hasAiConfiguration() ? ('ready' as const) : ('disabled' as const) },
    },
  })
})
