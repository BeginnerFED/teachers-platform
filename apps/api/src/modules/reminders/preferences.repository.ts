import type { NotificationPreferences, UpdateNotificationPreferencesBody } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export const preferencesRepository = {
  async get(profileId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('lesson_reminders,homework_reminders')
      .eq('profile_id', profileId)
      .maybeSingle()
    if (error) throwFromPostgrest(error, 'read notification preferences')
    return {
      lessonReminders: data?.lesson_reminders ?? true,
      homeworkReminders: data?.homework_reminders ?? true,
    }
  },
  async update(
    profileId: string,
    body: UpdateNotificationPreferencesBody,
  ): Promise<NotificationPreferences> {
    // The RPC merges only supplied fields atomically, including the first save.
    const { data, error } = await supabaseAdmin.rpc('set_notification_preferences', {
      p_profile: profileId,
      p_lesson_reminders: body.lessonReminders,
      p_homework_reminders: body.homeworkReminders,
    })
    if (error) throwFromPostgrest(error, 'save notification preferences')
    const row = data![0]!
    return { lessonReminders: row.lesson_reminders, homeworkReminders: row.homework_reminders }
  },
}
