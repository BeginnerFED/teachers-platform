import { EXTENSION_BY_MIME, type Tables, type TablesInsert } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest, throwFromStorage } from '../../lib/supabase/errors'

/**
 * Private, and named here rather than in the environment: the migration creates this exact
 * bucket, so a setting that could disagree with it would only ever be a way to break it.
 */
const BUCKET = 'material-media'

export type AssetRow = Tables<'material_assets'>

/** What actually landed in the bucket, as the bucket saw it. */
export type StoredObject = { sizeBytes: number; mimeType: string }

export type AssetsRepository = {
  findById(id: string): Promise<AssetRow | null>
  listFor(materialId: string): Promise<AssetRow[]>
  insert(values: TablesInsert<'material_assets'>): Promise<AssetRow>
  markUploaded(id: string, stored: StoredObject): Promise<AssetRow | null>
  remove(id: string): Promise<void>
  /** A URL the browser may PUT one file to, once, soon. */
  signUpload(path: string): Promise<string>
  /** A URL the browser may GET the file from, for a while. */
  signDownload(path: string, expiresIn: number): Promise<string>
  /** What the bucket holds at this path, or null if the upload never arrived. */
  statObject(path: string): Promise<StoredObject | null>
  copyObject(from: string, to: string): Promise<void>
  deleteObject(path: string): Promise<void>
  /** Several at once, in one request. Paths nothing is stored at are not an error. */
  deleteObjects(paths: string[]): Promise<void>
  /**
   * Everything stored under a lesson's folder — including files whose blocks were removed
   * from the lesson and whose rows are already gone. The bucket, not the table, is what
   * knows what it holds.
   */
  deleteFolder(materialId: string): Promise<number>
}

/** `<material>/<asset>.<ext>` — the material first, so one lesson's files sit together. */
export function assetPath(materialId: string, assetId: string, mimeType: string): string {
  return `${materialId}/${assetId}.${EXTENSION_BY_MIME[mimeType] ?? 'bin'}`
}

const bucket = () => supabaseAdmin.storage.from(BUCKET)

export const assetsRepository: AssetsRepository = {
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('material_assets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find asset')

    return data
  },

  async listFor(materialId) {
    const { data, error } = await supabaseAdmin
      .from('material_assets')
      .select('*')
      .eq('material_id', materialId)
      .not('uploaded_at', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throwFromPostgrest(error, 'list assets')

    return data ?? []
  },

  async insert(values) {
    const { data, error } = await supabaseAdmin
      .from('material_assets')
      .insert(values)
      .select('*')
      .single()

    if (error) throwFromPostgrest(error, 'reserve asset')

    return data
  },

  async markUploaded(id, stored) {
    const { data, error } = await supabaseAdmin
      .from('material_assets')
      .update({
        uploaded_at: new Date().toISOString(),
        size_bytes: stored.sizeBytes,
        mime_type: stored.mimeType,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'confirm asset')

    return data
  },

  async remove(id) {
    const { error } = await supabaseAdmin.from('material_assets').delete().eq('id', id)

    if (error) throwFromPostgrest(error, 'delete asset')
  },

  async signUpload(path) {
    const { data, error } = await bucket().createSignedUploadUrl(path)

    if (error) throwFromStorage(error, 'sign upload')

    return data.signedUrl
  },

  async signDownload(path, expiresIn) {
    const { data, error } = await bucket().createSignedUrl(path, expiresIn)

    if (error) throwFromStorage(error, 'sign download')

    return data.signedUrl
  },

  async statObject(path) {
    const slash = path.lastIndexOf('/')
    const folder = path.slice(0, slash)
    const name = path.slice(slash + 1)

    // `list` with a search rather than `info`: one folder here holds one lesson's files, so
    // it is a cheap lookup, and it does not depend on the newer object-info endpoint being
    // available on whichever Storage version the project is running.
    const { data, error } = await bucket().list(folder, { search: name, limit: 1 })

    if (error) throwFromStorage(error, 'read file')

    const found = data?.find((object) => object.name === name)
    if (!found) return null

    const metadata = (found.metadata ?? {}) as { size?: number; mimetype?: string }

    return {
      sizeBytes: metadata.size ?? 0,
      mimeType: metadata.mimetype ?? 'application/octet-stream',
    }
  },

  async copyObject(from, to) {
    const { error } = await bucket().copy(from, to)

    if (error) throwFromStorage(error, 'copy file')
  },

  async deleteObject(path) {
    const { error } = await bucket().remove([path])

    if (error) throwFromStorage(error, 'remove file')
  },

  async deleteObjects(paths) {
    if (paths.length === 0) return

    const { error } = await bucket().remove(paths)

    if (error) throwFromStorage(error, 'remove files')
  },

  async deleteFolder(materialId) {
    // A page at a time: `list` answers at most `limit` names, and a lesson with more
    // files than that is unlikely but not impossible.
    const PAGE = 200
    let removed = 0

    for (;;) {
      const { data, error } = await bucket().list(materialId, { limit: PAGE })

      if (error) throwFromStorage(error, 'list files')

      // Folders come back without an id; a lesson's files sit flat, so there are none.
      const names = (data ?? []).filter((object) => object.id).map((object) => object.name)
      if (names.length === 0) return removed

      const { error: removeError } = await bucket().remove(
        names.map((name) => `${materialId}/${name}`),
      )

      if (removeError) throwFromStorage(removeError, 'remove files')

      removed += names.length
      if (names.length < PAGE) return removed
    }
  },
}
