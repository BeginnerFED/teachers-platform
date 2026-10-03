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
import { assignmentSnapshots } from '../assignments/assignment-snapshots.repository'
import { parseBlocks } from '../materials/materials.mapper'
import { materialsRepository, type MaterialsRepository } from '../materials/materials.repository'
import { assertHostAccess, assertTeachingAccess } from '../subscriptions/teaching-access'
import type { OpenLiveRoom } from '../live/live.repository'
import { openRooms, type OpenRooms } from '../live/open-rooms'
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

/**
 * How long a room's answer about one of its files is reused, the checks and the signed link
 * alike: a class arriving at a step together is one question per file, not one per person.
 * A link reused for this long still has most of its own lifetime left when it is fetched.
 */
const LIVE_GRANT_MS = 20_000
const LIVE_LINK_SECONDS = 60
/** Expired answers are swept out once this many are held; only open rooms' files are kept. */
const LIVE_GRANTS_SWEEP_AT = 500

export type AssetsServiceDeps = {
  assets: AssetsRepository
  materials: Pick<typeof materialsService, 'editable' | 'playable'>
  /** Which rooms are open, as a list believed for up to ten seconds (see open-rooms). */
  rooms: Pick<OpenRooms, 'find'>
  materialSteps: Pick<MaterialsRepository, 'stepsFor'>
  assertLiveHost: typeof assertHostAccess
}

export function createAssetsService({
  assets,
  materials,
  rooms,
  materialSteps,
  assertLiveHost,
}: AssetsServiceDeps) {
  /** An asset is exactly as private as its lesson, and answers the same way when it is not yours. */
  async function readable(assetId: string, viewer: Viewer): Promise<AssetRow> {
    const asset = await assets.findById(assetId)
    if (!asset) throw new NotFoundError('No such file')

    if (await assignmentSnapshots.canReadAsset(asset.id, viewer)) return asset
    if (!asset.material_id) throw new NotFoundError('No such file')
    if (viewer.role === 'teacher') await assertTeachingAccess(viewer.id)

    // Throws 404 of its own if the lesson is not theirs to see, which is the right answer
    // here too: knowing a file exists is knowing the lesson does.
    await materials.playable(asset.material_id, viewer)

    return asset
  }

  async function editable(assetId: string, viewer: Viewer): Promise<AssetRow> {
    const asset = await assets.findById(assetId)
    if (!asset?.material_id) throw new NotFoundError('No such file')

    await materials.editable(asset.material_id, viewer)

    return asset
  }

  /**
   * A room link grants access only to files actually shown in that room's lesson. The link
   * signed here is fetched by the API only, never given to the guest's browser.
   */
  async function liveLink(room: OpenLiveRoom, assetId: string): Promise<string> {
    // The file before the host: a made-up file id costs one lookup, and the room's own
    // budget is what limits how many of those anyone holding its link can ask about.
    const asset = await assets.findById(assetId)
    if (!asset || !asset.uploaded_at || asset.material_id !== room.material_id) {
      throw new NotFoundError('No such file')
    }

    await assertLiveHost(room.teacher_id)

    const steps = await materialSteps.stepsFor(room.material_id)
    const used = steps.some((step) =>
      parseBlocks(step.blocks).some((block) =>
        block.type === 'image' || block.type === 'audio'
          ? block.assetId === assetId
          : block.type === 'reading' && block.audioAssetId === assetId,
      ),
    )
    if (!used) throw new NotFoundError('No such file')

    return assets.signDownload(asset.path, LIVE_LINK_SECONDS)
  }

  // Answers already given, by room and file. A lesson cannot be edited while a room teaches
  // it, so what a room may show does not change under an answer while it is held.
  const grants = new Map<string, { at: number; link: Promise<string> }>()

  /**
   * Shared by everybody who asks while it is fresh, those who ask while it is still being
   * worked out included. A refusal or a failure is not kept: the next request asks again.
   */
  function grant(room: OpenLiveRoom, assetId: string): Promise<string> {
    const key = `${room.id} ${assetId}`
    const now = Date.now()
    const held = grants.get(key)
    if (held && now - held.at < LIVE_GRANT_MS) return held.link

    if (grants.size >= LIVE_GRANTS_SWEEP_AT) {
      for (const [id, entry] of grants) if (now - entry.at >= LIVE_GRANT_MS) grants.delete(id)
    }

    const link = liveLink(room, assetId)
    grants.set(key, { at: now, link })
    link.catch(() => {
      if (grants.get(key)?.link === link) grants.delete(key)
    })

    return link
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

    /**
     * Where an open room's file is, for the API's own streaming route. Asked once per room
     * and file and shared while fresh: a whole class turning to a step together is the
     * normal case here, not the exception.
     */
    async urlForLive(assetId: string, sessionId: string): Promise<string> {
      const room = await rooms.find(sessionId)
      if (!room) throw new NotFoundError('No such file')

      return grant(room, assetId)
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

      // Removing a block may detach its media, but existing homework still owns its bytes.
      if (await assignmentSnapshots.holdsAsset(asset.id)) return

      await assets.deleteObject(asset.path)
      await assets.remove(asset.id)
    },
  }
}

export type AssetsService = ReturnType<typeof createAssetsService>

export const assetsService = createAssetsService({
  assets: assetsRepository,
  materials: materialsService,
  rooms: openRooms,
  materialSteps: materialsRepository,
  assertLiveHost: assertHostAccess,
})
