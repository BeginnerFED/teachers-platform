import { z } from 'zod'
import type { Enums } from '../database.types'

/**
 * The files a lesson carries: a picture to look at, a recording to listen to. Video is
 * embedded from YouTube and never hosted, so it has no asset — hosting video is the single
 * most expensive thing this platform could decide to do.
 *
 * Bytes never pass through the API. It mints a one-time upload URL, the browser puts the
 * file straight into private storage, and reads come back as short-lived signed URLs that
 * only somebody who may read the lesson can ask for. No public URL exists at any point.
 */

export const ASSET_KINDS = ['image', 'audio'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/** The same tripwire the other enums have: this list and the Postgres one must agree. */
export const assetKindsMatchDatabase: Exact<AssetKind, Enums<'asset_kind'>> = true

/**
 * What a browser can be counted on to display, and nothing else. SVG is deliberately
 * absent: it is a document that can carry script, and it would be served from our origin.
 */
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

/**
 * `audio/webm` and `audio/mp4` are here for the recorder as much as for uploads: those are
 * what MediaRecorder produces, webm+opus on Chrome and Firefox, mp4 on Safari.
 */
export const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  // What Windows hands over for a .mp3 it does not recognise from the registry.
  'audio/mp3',
  'audio/mp4',
  // Safari records .m4a and reports it either way depending on where the file came from.
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
] as const

export const ACCEPTED_MIME_TYPES: Record<AssetKind, readonly string[]> = {
  image: IMAGE_MIME_TYPES,
  audio: AUDIO_MIME_TYPES,
}

/** A phone photo is a few megabytes; twenty minutes of speech at 128 kbps is about twenty. */
export const MAX_ASSET_BYTES: Record<AssetKind, number> = {
  image: 8 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
}

/** The one place that knows how a stored file is named, so uploads and reads agree. */
export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'weba',
}

export const assetIdParam = z.object({ assetId: z.uuid() })

/**
 * Asking for somewhere to put a file. The size and type are what the browser claims; the
 * bucket enforces both again on the way in, and the confirm step reads back what actually
 * landed — so a lie here buys nothing.
 */
export const createUploadBody = z
  .object({
    materialId: z.uuid(),
    kind: z.enum(ASSET_KINDS),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.number().int().positive(),
    /** Only ever shown back to the author, so they can tell two recordings apart. */
    fileName: z.string().trim().max(200).optional(),
  })
  .refine((body) => ACCEPTED_MIME_TYPES[body.kind].includes(body.mimeType), {
    message: 'That file type cannot be used here',
    path: ['mimeType'],
  })
  .refine((body) => body.sizeBytes <= MAX_ASSET_BYTES[body.kind], {
    message: 'That file is too large',
    path: ['sizeBytes'],
  })

export type CreateUploadBody = z.infer<typeof createUploadBody>

/* ----------------------------------------------------------------- responses --- */

export type MaterialAsset = {
  id: string
  materialId: string
  kind: AssetKind
  mimeType: string
  sizeBytes: number
  fileName: string | null
  createdAt: string
}

export type UploadTicket = {
  /** Already reserved: the block can name this the moment the bytes are up. */
  assetId: string
  /**
   * Where the browser PUTs the file. One file, one path, a few minutes — and useless for
   * anything else, which is what makes handing it to a browser safe.
   */
  uploadUrl: string
}

export type AssetUrl = {
  /** Signed, short-lived, and never rendered into a page: pages point at /media/<id>. */
  url: string
  /** Seconds. What the caller may cache it for. */
  expiresIn: number
}
