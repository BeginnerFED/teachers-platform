import {
  ACCEPTED_MIME_TYPES,
  MAX_ASSET_BYTES,
  type AssetUrl,
  type CreateUploadBody,
  type MaterialAsset,
  type UploadTicket,
} from '@tp/shared'
import { ConflictError, NotFoundError, RuleViolationError } from '../../http/errors'
import { materialsService, type Viewer } from '../materials/materials.service'
import { toMaterialAsset } from './assets.mapper'
import {
  assetPath,
  assetsRepository,
  type AssetRow,
  type AssetsRepository,
} from './assets.repository'

/**
 * Long enough that a lesson left open through a break still shows its pictures, short
 * enough that a link someone copies out of the network tab stops working the same morning.
 */
const READ_TTL_SECONDS = 3600

export type AssetsServiceDeps = {
  assets: AssetsRepository
  materials: Pick<typeof materialsService, 'editable' | 'playable'>
}

export function createAssetsService({ assets, materials }: AssetsServiceDeps) {
  /** An asset is exactly as private as its lesson, and answers the same way when it is not yours. */
  async function readable(assetId: string, viewer: Viewer): Promise<AssetRow> {
    const asset = await assets.findById(assetId)
    if (!asset) throw new NotFoundError('No such file')

    // Throws 404 of its own if the lesson is not theirs to see, which is the right answer
    // here too: knowing a file exists is knowing the lesson does.
    await materials.playable(asset.material_id, viewer)

    return asset
  }

  async function editable(assetId: string, viewer: Viewer): Promise<AssetRow> {
    const asset = await assets.findById(assetId)
    if (!asset) throw new NotFoundError('No such file')

    await materials.editable(asset.material_id, viewer)

    return asset
  }

  return {
    /**
     * Somewhere to put a file. The id is minted here rather than by the database so the
     * path can be built from it in the same breath — but the row stays unconfirmed, and
     * nothing in a lesson may point at it, until the bytes have actually landed.
     */
    async createUpload(body: CreateUploadBody, viewer: Viewer): Promise<UploadTicket> {
      await materials.editable(body.materialId, viewer)

      const assetId = crypto.randomUUID()
      const path = assetPath(body.materialId, assetId, body.mimeType)

      await assets.insert({
        id: assetId,
        material_id: body.materialId,
        owner_id: viewer.id,
        kind: body.kind,
        path,
        mime_type: body.mimeType,
        size_bytes: body.sizeBytes,
        file_name: body.fileName ?? null,
      })

      return { assetId, uploadUrl: await assets.signUpload(path) }
    },

    /**
     * The bytes are up. Read back what the bucket actually took — the size and type here
     * are the file's own, not what the browser claimed about it before sending — and only
     * then is the asset something a lesson may point at.
     */
    async confirmUpload(assetId: string, viewer: Viewer): Promise<MaterialAsset> {
      const asset = await editable(assetId, viewer)

      if (asset.uploaded_at) return toMaterialAsset(asset)

      const stored = await assets.statObject(asset.path)
      if (!stored) throw new ConflictError('That file never finished uploading')

      if (stored.sizeBytes > MAX_ASSET_BYTES[asset.kind]) {
        await assets.deleteObject(asset.path)
        await assets.remove(asset.id)
        throw new RuleViolationError('That file is too large')
      }

      // The bucket allows both kinds' types, so it cannot tell an image slipped into an
      // audio block from a real one. This can.
      if (!ACCEPTED_MIME_TYPES[asset.kind].includes(stored.mimeType)) {
        await assets.deleteObject(asset.path)
        await assets.remove(asset.id)
        throw new RuleViolationError('That file type cannot be used here')
      }

      const updated = await assets.markUploaded(asset.id, stored)
      if (!updated) throw new NotFoundError('No such file')

      return toMaterialAsset(updated)
    },

    /** Where to actually fetch it. Signed, brief, and only ever handed to a redirect. */
    async urlFor(assetId: string, viewer: Viewer): Promise<AssetUrl> {
      const asset = await readable(assetId, viewer)

      if (!asset.uploaded_at) throw new NotFoundError('That file never finished uploading')

      return {
        url: await assets.signDownload(asset.path, READ_TTL_SECONDS),
        expiresIn: READ_TTL_SECONDS,
      }
    },

    async list(materialId: string, viewer: Viewer): Promise<MaterialAsset[]> {
      await materials.editable(materialId, viewer)

      return (await assets.listFor(materialId)).map(toMaterialAsset)
    },

    /**
     * The file goes first, then the row: a row with no file behind it is a broken picture
     * in a lesson, and an orphaned file is only wasted space.
     */
    async remove(assetId: string, viewer: Viewer): Promise<void> {
      const asset = await editable(assetId, viewer)

      await assets.deleteObject(asset.path)
      await assets.remove(asset.id)
    },
  }
}

export type AssetsService = ReturnType<typeof createAssetsService>

export const assetsService = createAssetsService({
  assets: assetsRepository,
  materials: materialsService,
})
