import { UpstreamUnavailableError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'

export const healthRepository = {
  /** Cheapest possible round trip that proves the database answers. */
  async ping(): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(1)

    if (error) {
      throw new UpstreamUnavailableError('Database is not reachable', { cause: error })
    }
  },
}
