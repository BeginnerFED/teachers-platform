import {
  blockDraftSchema,
  blockSchema,
  toStudentBlock,
  type Block,
  type BlockDraft,
  type MaterialDetail,
  type MaterialListItem,
  type MaterialStep,
  type StudentMaterial,
  type StudentMaterialStep,
} from '@tp/shared'
import type { MaterialRow, MaterialStepRow } from './materials.repository'

/**
 * The strict reading: only blocks fit to put in front of a student. Anything unfinished
 * or no longer valid is dropped rather than allowed to throw — one bad block should cost
 * a teacher that block, not the whole lesson. This is what the player and the marker use.
 */
export function parseBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate) => {
    const parsed = blockSchema.safeParse(candidate)

    return parsed.success ? [parsed.data] : []
  })
}

/**
 * The author's reading: everything they have saved, finished or not, so the editor can
 * hand a half-written exercise back to the person writing it. Only an entry with no id or
 * an unknown type is dropped, which is nothing a real save can produce.
 */
export function parseDrafts(value: unknown): BlockDraft[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate) => {
    const parsed = blockDraftSchema.safeParse(candidate)

    return parsed.success ? [parsed.data] : []
  })
}

export function toMaterialListItem(row: MaterialRow, viewerId: string): MaterialListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    level: row.level,
    tags: row.tags,
    visibility: row.visibility,
    status: row.status,
    durationMinutes: row.duration_minutes,
    stepCount: row.material_steps[0]?.count ?? 0,
    // The official library speaks for the platform rather than for whichever admin
    // happened to type it, so a platform material names no author.
    owner:
      row.visibility === 'platform' || !row.owner
        ? null
        : { id: row.owner.id, fullName: row.owner.full_name, email: row.owner.email },
    canEdit: row.owner_id === viewerId,
    sourceMaterialId: row.source_material_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function toMaterialStep(row: MaterialStepRow): MaterialStep {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    blocks: parseDrafts(row.blocks),
    updatedAt: row.updated_at,
  }
}

export function toMaterialDetail(
  row: MaterialRow,
  steps: MaterialStepRow[],
  viewerId: string,
): MaterialDetail {
  return { ...toMaterialListItem(row, viewerId), steps: steps.map(toMaterialStep) }
}

/**
 * The same lesson with every answer taken out of it. This is the only projection a student
 * is ever sent, which is what lets marking stay a server-side fact.
 */
export function toStudentMaterialStep(row: MaterialStepRow): StudentMaterialStep {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    blocks: parseBlocks(row.blocks).map((block) => toStudentBlock(block)),
  }
}

export function toStudentMaterial(row: MaterialRow, steps: MaterialStepRow[]): StudentMaterial {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    level: row.level,
    durationMinutes: row.duration_minutes,
    steps: steps.map(toStudentMaterialStep),
  }
}
