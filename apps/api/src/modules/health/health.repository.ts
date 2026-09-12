import { UpstreamUnavailableError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'

export const healthRepository = {
  /** Cheapest possible round trip that proves the database answers. */
  async ping(): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id', { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(5000))

    if (error) {
      throw new UpstreamUnavailableError('Database is not reachable', { cause: error })
    }
  },
  async reminders(): Promise<void> {
    const { data, error } = await supabaseAdmin
      .rpc('reminder_job_health')
      .abortSignal(AbortSignal.timeout(5000))
    const state = data as { enabled?: boolean; lastSucceededAt?: string | null } | null
    const last = state?.lastSucceededAt ? Date.parse(state.lastSucceededAt) : NaN
    if (error || !state?.enabled || !Number.isFinite(last) || Date.now() - last > 5 * 60_000) {
      throw new UpstreamUnavailableError('Reminder scheduler is not healthy', { cause: error })
    }
  },
}
