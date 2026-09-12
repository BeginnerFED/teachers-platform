import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export const dashboardRepository = {
  async recentAccounts(limit: number) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name,email,role,created_at')
      .in('role', ['teacher', 'student'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (error) throwFromPostgrest(error, 'list recent accounts')
    return data ?? []
  },

  async recentAccessChanges(limit: number) {
    const { data, error } = await supabaseAdmin
      .from('subscription_events')
      .select(
        `
        id,type,payload,created_at,
        subject:profiles!subscription_events_profile_id_fkey!inner(id,full_name,email),
        actor:profiles!subscription_events_actor_id_fkey(full_name,email)
      `,
      )
      .eq('subject.role', 'teacher')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (error) throwFromPostgrest(error, 'list recent access changes')
    return data ?? []
  },

  async recentRosterChanges(limit: number) {
    const { data, error } = await supabaseAdmin
      .from('teacher_students')
      .select(
        `
        id,status,updated_at,
        student:profiles!teacher_students_student_id_fkey!inner(id,full_name,email),
        teacher:profiles!teacher_students_teacher_id_fkey!inner(id,full_name,email)
      `,
      )
      .eq('student.role', 'student')
      .eq('teacher.role', 'teacher')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (error) throwFromPostgrest(error, 'list recent roster changes')
    return data ?? []
  },
}
