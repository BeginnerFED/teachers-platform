import {
  lessonSeriesCancellationPreview,
  lessonSeriesCancellationResult,
  type CancelLessonSeriesBody,
} from '@tp/shared'
import type { PostgrestError } from '@supabase/supabase-js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RuleViolationError,
  ValidationError,
} from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

function check(error: PostgrestError | null) {
  if (!error) return
  if (error.code === 'P0001' || error.code === '40001' || error.code === '23505')
    throw new ConflictError('Lesson series changed', { reason: 'lesson_changed' })
  if (error.code === '42501') throw new ForbiddenError('Choose your own lesson series')
  if (error.code === 'P0002') throw new NotFoundError('Upcoming lesson series not found')
  if (error.code === '55000')
    throw new RuleViolationError(
      'Only upcoming lessons without active live rooms can be canceled together',
    )
  if (error.code === '22023') throw new ValidationError('Invalid cancellation')
  throwFromPostgrest(error, 'cancel lesson series')
}

export const cancellationRepository = {
  async preview(teacherId: string, lessonId: string) {
    const { data, error } = await supabaseAdmin.rpc('preview_lesson_series_cancellation', {
      p_teacher: teacherId,
      p_lesson: lessonId,
    })
    check(error)
    return lessonSeriesCancellationPreview.parse(data)
  },
  async cancel(teacherId: string, lessonId: string, body: CancelLessonSeriesBody) {
    const { data, error } = await supabaseAdmin.rpc('cancel_lesson_series', {
      p_teacher: teacherId,
      p_lesson: lessonId,
      p_request: body.requestId,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_series_version: body.expectedSeriesUpdatedAt,
    })
    check(error)
    return lessonSeriesCancellationResult.parse(data)
  },
}
