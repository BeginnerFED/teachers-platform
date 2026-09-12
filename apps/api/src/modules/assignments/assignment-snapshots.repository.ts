import type { Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { NotFoundError } from '../../http/errors'
import type { Viewer } from '../materials/materials.service'
import type { MaterialStepRow } from '../materials/materials.repository'

export const assignmentSnapshots = {
  async get(assignmentId: string) {
    const { data, error } = await supabaseAdmin
      .from('assignment_snapshots')
      .select('material,steps')
      .eq('assignment_id', assignmentId)
      .maybeSingle()
    if (error) throwFromPostgrest(error, 'read assignment snapshot')
    if (!data) throw new NotFoundError('Assignment content is unavailable')
    return {
      material: data.material as unknown as Tables<'materials'>,
      steps: data.steps as unknown as MaterialStepRow[],
    }
  },
  async holdsAsset(assetId: string) {
    const { count, error } = await supabaseAdmin
      .from('assignment_snapshot_assets')
      .select('asset_id', { count: 'exact', head: true })
      .eq('asset_id', assetId)
    if (error) throwFromPostgrest(error, 'check archived asset')
    return (count ?? 0) > 0
  },
  async canReadAsset(assetId: string, viewer: Viewer) {
    const { data, error } = await supabaseAdmin
      .from('assignment_snapshot_assets')
      .select(
        'snapshot:assignment_snapshots!inner(assignment:assignments!inner(teacher_id,student_id))',
      )
      .eq('asset_id', assetId)
    if (error) throwFromPostgrest(error, 'authorize assignment asset')
    return (data ?? []).some(
      ({ snapshot }) =>
        viewer.role === 'admin' ||
        snapshot.assignment.teacher_id === viewer.id ||
        snapshot.assignment.student_id === viewer.id,
    )
  },
}
