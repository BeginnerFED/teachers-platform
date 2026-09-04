import type { MaterialAsset } from '@tp/shared'
import type { AssetRow } from './assets.repository'

/** The row minus where the bytes live: a path is ours, and a client has no use for one. */
export function toMaterialAsset(row: AssetRow): MaterialAsset {
  return {
    id: row.id,
    materialId: row.material_id,
    kind: row.kind,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    fileName: row.file_name,
    createdAt: row.created_at,
  }
}
