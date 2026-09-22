import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../../http/context'
import {
  createAssignments,
  deleteAssignment,
  getAssignment,
  gradeAssignment,
  listAssignments,
  listRecipients,
  requestAssignmentRevision,
  saveProgress,
  suggestAssignmentFeedback,
  submitAssignment,
  summariseAssignments,
} from './assignments.controller'

/** A step's answers may include several writing blocks. */
const PROGRESS_BODY_BYTES = 256 * 1024

/**
 * Handing in and marking are commands, not PATCHes of a status column: what each is allowed
 * to change, and when, is a rule that lives on the server. One unbroken chain, for `AppType`.
 *
 * The fixed paths sit above `/:assignmentId`, or "summary" would be read as an id.
 */
export const assignmentsRoutes = new Hono<AppEnv>()
  .get('/', ...listAssignments)
  .post('/', ...createAssignments)
  .get('/summary', ...summariseAssignments)
  .get('/recipients', ...listRecipients)
  .get('/:assignmentId', ...getAssignment)
  .delete('/:assignmentId', ...deleteAssignment)
  .post('/:assignmentId/progress', bodyLimit({ maxSize: PROGRESS_BODY_BYTES }), ...saveProgress)
  .post('/:assignmentId/submit', ...submitAssignment)
  .post('/:assignmentId/grade', ...gradeAssignment)
  .post('/:assignmentId/request-revision', ...requestAssignmentRevision)
  .post('/:assignmentId/ai-feedback', ...suggestAssignmentFeedback)
