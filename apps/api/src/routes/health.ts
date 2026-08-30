import { Hono } from 'hono'
import { ACTIVITY_TYPES, LEVELS, ROLES } from '@tp/shared'

export const health = new Hono().get('/', (c) =>
  c.json({
    status: 'ok' as const,
    roles: ROLES,
    levels: LEVELS,
    activityTypes: ACTIVITY_TYPES,
  }),
)
