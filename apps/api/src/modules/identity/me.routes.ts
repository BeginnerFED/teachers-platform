import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { getMe, updateMe } from './me.controller'
import { studyRoutes } from '../study/study.routes'
import { remindersRoutes } from '../reminders/reminders.routes'
import { listMyLessons, scheduleMyLesson, updateMyLesson } from '../lessons/lessons.controller'
import {
  previewMyLessonCancellation,
  cancelMyFollowingLessons,
  recordMyAttendance,
  getMyStudentCredits,
  grantMyStudentCredits,
  listMyPendingLessons,
  reverseMyStudentCredits,
  listMyStudentOverview,
} from '../lessons/attendance.controller'

export const meRoutes = new Hono<AppEnv>()
  .get('/', ...getMe)
  .patch('/', ...updateMe)
  .route('/study', studyRoutes)
  .route('/notifications', remindersRoutes)
  .get('/lessons', ...listMyLessons)
  .post('/lessons', ...scheduleMyLesson)
  .get('/lessons/pending', ...listMyPendingLessons)
  .patch('/lessons/:lessonId', ...updateMyLesson)
  .patch('/lessons/:lessonId/attendance', ...recordMyAttendance)
  .get('/lessons/:lessonId/cancellation', ...previewMyLessonCancellation)
  .post('/lessons/:lessonId/cancel-following', ...cancelMyFollowingLessons)
  .get('/students/:studentId/lesson-credits', ...getMyStudentCredits)
  .post('/students/:studentId/lesson-credits', ...grantMyStudentCredits)
  .post('/students/:studentId/lesson-credits/:grantId/reverse', ...reverseMyStudentCredits)
  .get('/students/overview', ...listMyStudentOverview)
