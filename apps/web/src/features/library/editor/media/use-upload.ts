'use client'

import { useRef, useState } from 'react'
import {
  ACCEPTED_MIME_TYPES,
  MAX_ASSET_BYTES,
  type AssetKind,
  type MaterialAsset,
} from '@tp/shared'
import { confirmUpload, requestUpload } from '../../actions'
import { trackUpload } from '../editor-flush'
import { putFile } from './upload'

export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number; name: string }
  | { status: 'failed'; reason: 'tooLarge' | 'wrongType' | 'failed' }

/**
 * Ask for a ticket, put the bytes where it says, tell the server they landed, and only
 * then hand the block its asset. Three steps because the middle one does not go to us —
 * and the block learning the id a moment early would be a block pointing at nothing.
 *
 * The whole chain is registered with the editor's flush, so previewing or navigating away
 * mid-upload waits for it rather than losing the file.
 */
export function useMediaUpload({
  materialId,
  kind,
  onDone,
}: {
  materialId: string
  kind: AssetKind
  onDone: (asset: MaterialAsset) => void
}) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const abort = useRef<(() => void) | null>(null)
  // Set the moment the author cancels, so the failure that follows is understood as their
  // own doing and reported as nothing at all rather than as "it went wrong".
  const cancelled = useRef(false)

  const start = (file: File) => {
    cancelled.current = false

    // Checked here as well as on the server, because "that file is too big" is worth
    // saying before spending a minute discovering it.
    if (!ACCEPTED_MIME_TYPES[kind].includes(file.type)) {
      setState({ status: 'failed', reason: 'wrongType' })
      return
    }

    if (file.size > MAX_ASSET_BYTES[kind]) {
      setState({ status: 'failed', reason: 'tooLarge' })
      return
    }

    setState({ status: 'uploading', progress: 0, name: file.name })

    void trackUpload(
      (async () => {
        try {
          const { ticket, error } = await requestUpload({
            materialId,
            kind,
            mimeType: file.type,
            sizeBytes: file.size,
            fileName: file.name,
          })

          if (!ticket) throw new Error(error ?? 'failed')
          // Cancelled while the ticket was being minted: stop before a byte is sent.
          if (cancelled.current) return

          const put = putFile(ticket.uploadUrl, file, (progress) =>
            setState((current) =>
              current.status === 'uploading' ? { ...current, progress } : current,
            ),
          )
          abort.current = put.abort

          await put.done

          const confirmed = await confirmUpload(ticket.assetId)
          if (!confirmed.asset) throw new Error(confirmed.error ?? 'failed')

          setState({ status: 'idle' })
          onDone(confirmed.asset)
        } catch {
          if (!cancelled.current) setState({ status: 'failed', reason: 'failed' })
        } finally {
          abort.current = null
        }
      })(),
    )
  }

  return {
    state,
    start,
    cancel: () => {
      cancelled.current = true
      abort.current?.()
      // Straight back to the empty frame. Cancelling is not a failure and should not
      // leave a red line behind explaining one.
      setState({ status: 'idle' })
    },
    dismiss: () => setState({ status: 'idle' }),
  }
}
