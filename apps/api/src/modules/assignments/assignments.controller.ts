import {
  assignmentIdParam,
  createAssignmentsBody,
  gradeAssignmentBody,
  listAssignmentsQuery,
  saveProgressBody,
} from '@tp/shared'
import { getAuth, type AppEnv } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import type { Viewer } from '../materials/materials.service'
import { assignmentsService } from './assignments.service'
import type { Context } from 'hono'

/**
 * Two sides of the same rows. Teachers set, withdraw and mark; students answer and hand in;
 * both read. The service decides whose row it is — these only decide who may knock.
 */
const teachers = [requireAuth, requireRole('admin', 'teacher')] as const
const students = [requireAuth, requireRole('student')] as const

const viewer = (c: Context<AppEnv>): Viewer => {
  const auth = getAuth(c)

  return { id: auth.userId, role: auth.role }
}

export const listAssignments = factory.createHandlers(
  requireAuth,
  validate('query', listAssignmentsQuery),
  async (c) => {
    const { items, meta } = await assignmentsService.list(c.req.valid('query'), viewer(c))

    return c.json({ data: items, meta })
  },
)

/** Who this teacher can set homework for. */
export const listRecipients = factory.createHandlers(...teachers, async (c) => {
  const data = await assignmentsService.recipients(viewer(c))

  return c.json({ data })
})

export const createAssignments = factory.createHandlers(
  ...teachers,
  validate('json', createAssignmentsBody),
  async (c) => {
    const data = await assignmentsService.create(c.req.valid('json'), viewer(c))

    return c.json({ data }, 201)
  },
)

export const getAssignment = factory.createHandlers(
  requireAuth,
  validate('param', assignmentIdParam),
  async (c) => {
    const data = await assignmentsService.get(c.req.valid('param').assignmentId, viewer(c))

    return c.json({ data })
  },
)

export const deleteAssignment = factory.createHandlers(
  ...teachers,
  validate('param', assignmentIdParam),
  async (c) => {
    const { assignmentId } = c.req.valid('param')
    await assignmentsService.remove(assignmentId, viewer(c))

    return c.json({ data: { id: assignmentId } })
  },
)

export const saveProgress = factory.createHandlers(
  ...students,
  validate('param', assignmentIdParam),
  validate('json', saveProgressBody),
  async (c) => {
    const data = await assignmentsService.saveProgress(
      c.req.valid('param').assignmentId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)

export const submitAssignment = factory.createHandlers(
  ...students,
  validate('param', assignmentIdParam),
  async (c) => {
    const data = await assignmentsService.submit(c.req.valid('param').assignmentId, viewer(c))

    return c.json({ data })
  },
)

export const gradeAssignment = factory.createHandlers(
  ...teachers,
  validate('param', assignmentIdParam),
  validate('json', gradeAssignmentBody),
  async (c) => {
    const data = await assignmentsService.grade(
      c.req.valid('param').assignmentId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)
