import type { StudyUpdate } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { preferencesRepository } from './preferences.repository'

export const remindersRepository = {
  async list(recipientId: string): Promise<StudyUpdate[]> {
    const preferences = await preferencesRepository.get(recipientId)
    const kinds = [
      ...(preferences.lessonReminders ? ['lesson_reminder'] : []),
      ...(preferences.homeworkReminders ? ['homework_due'] : []),
    ]
    if (!kinds.length) return []
    const { data, error } = await supabaseAdmin
      .from('scheduled_reminders')
      .select('id,kind,lesson_id,assignment_id,title,scheduled_at,expires_at,updated_at,read_at')
      .eq('recipient_id', recipientId)
      .in('kind', kinds)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .order('id')
      .limit(30)
    if (error) throwFromPostgrest(error, 'read reminders')
    return (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as 'lesson_reminder' | 'homework_due',
      entityId: (row.lesson_id ?? row.assignment_id)!,
      title: row.title,
      scheduledAt: row.scheduled_at,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
      readAt: row.read_at,
    }))
  },
  async markRead(recipientId: string, items: { id: string; updatedAt: string }[]) {
    for (const item of items) {
      const { error } = await supabaseAdmin
        .from('scheduled_reminders')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', recipientId)
        .eq('id', item.id)
        .eq('updated_at', item.updatedAt)
        .is('read_at', null)
      if (error) throwFromPostgrest(error, 'mark reminder read')
    }
  },
}
