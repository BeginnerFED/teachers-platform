import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { createStudent, getStudent, listStudents } from './students.controller'

/**
 * Read-only for now. Who teaches whom is the teacher's decision to make, so the actions
 * that change it belong with the teacher's own tools rather than here.
 */
export const studentsRoutes = new Hono<AppEnv>()
  .get('/', ...listStudents)
  .post('/', ...createStudent)
  .get('/:studentId', ...getStudent)
