import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import {
  createAssignments,
  deleteAssignment,
  getAssignment,
  gradeAssignment,
  listAssignments,
  listRecipients,
  saveProgress,
  submitAssignment,
} from './assignments.controller'

/**
 * Handing in and marking are commands, not PATCHes of a status column: what each is allowed
 * to change, and when, is a rule that lives on the server. One unbroken chain, for `AppType`.
 */
export const assignmentsRoutes = new Hono<AppEnv>()
  .get('/', ...listAssignments)
  .post('/', ...createAssignments)
  .get('/recipients', ...listRecipients)
  .get('/:assignmentId', ...getAssignment)
  .delete('/:assignmentId', ...deleteAssignment)
  .post('/:assignmentId/progress', ...saveProgress)
  .post('/:assignmentId/submit', ...submitAssignment)
  .post('/:assignmentId/grade', ...gradeAssignment)
