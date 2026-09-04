'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  HeadphonesIcon,
  ImageIcon,
  Loader2Icon,
  MicIcon,
  SquareIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { ACCEPTED_MIME_TYPES, MAX_ASSET_BYTES, type AssetKind } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { mediaSrc } from '../../media'
import { recordingSupported, startRecording, type Recording } from './recorder'
import { useMediaUpload } from './use-upload'

const ICON: Record<AssetKind, typeof ImageIcon> = { image: ImageIcon, audio: HeadphonesIcon }

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024))

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/**
 * The picture or the recording, in the block, exactly as a student will get it — and when
 * there is not one yet, the place you put it. The empty state is the control: a dashed
 * frame you drop a file onto or click, which becomes the thing itself once it has one.
 *
 * There is no file field with a label anywhere here. The author sees what they are making.
 */
export function MediaField({
  kind,
  materialId,
  assetId,
  alt,
  onAsset,
  onClear,
  t,
}: {
  kind: AssetKind
  materialId: string
  assetId?: string
  /** The image's own description, so the editor shows what a screen reader will read. */
  alt?: string
  onAsset: (assetId: string) => void
  onClear: () => void
  t: Messages
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const upload = useMediaUpload({ materialId, kind, onDone: (asset) => onAsset(asset.id) })

  const Icon = ICON[kind]
  const accept = ACCEPTED_MIME_TYPES[kind].join(',')

  const pick = (
    <input
      ref={input}
      type="file"
      accept={accept}
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) upload.start(file)
        // Cleared, so choosing the same file twice in a row still counts as a change.
        event.target.value = ''
      }}
    />
  )

  /**
   * Shown wherever the field happens to be — including over a block that already has a
   * picture. A file rejected while replacing one used to say nothing at all, which reads
   * as the button being broken.
   */
  const failure =
    upload.state.status === 'failed' ? (
      <p className="text-destructive flex items-center gap-2 text-xs">
        {t.library.editor.media[upload.state.reason]}
        <button
          type="button"
          onClick={upload.dismiss}
          aria-label={t.library.editor.media.dismiss}
          className="hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      </p>
    ) : null

  if (upload.state.status === 'uploading') {
    const percent = Math.round(upload.state.progress * 100)

    return (
      <div className="bg-muted/40 flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="max-w-60 truncate">{upload.state.name}</span>
          <span className="tabular-nums">{percent}%</span>
        </div>

        {/* Its own element rather than the shared Progress, because this one is inside a
            dashed frame that is about to become a picture and should not look like a page. */}
        <div className="bg-muted h-1 w-full max-w-xs overflow-hidden rounded-full">
          <div className="bg-primary h-full transition-[width]" style={{ width: `${percent}%` }} />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={upload.cancel}
          className="text-muted-foreground h-6 px-2 text-xs"
        >
          {t.library.editor.media.cancel}
        </Button>
      </div>
    )
  }

  if (assetId) {
    return (
      <div className="group/media relative flex flex-col gap-1">
        {kind === 'image' ? (
          // Not next/image: the optimiser cannot follow a private redirect, and the URL
          // behind it is signed afresh every hour, which is the opposite of what a cache
          // key wants. A plain img with a lazy hint is the honest thing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaSrc(assetId)}
            alt={alt ?? ''}
            loading="lazy"
            className="max-h-96 w-full rounded-lg border object-contain"
          />
        ) : (
          <audio src={mediaSrc(assetId)} controls preload="metadata" className="w-full" />
        )}

        {failure}

        {/* Out of the way until the block is hovered, like every other control in here. */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/media:opacity-100 max-sm:opacity-100">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t.library.editor.media.replace}
            onClick={() => input.current?.click()}
            className="size-7 shadow-sm"
          >
            <UploadIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t.library.editor.media.remove}
            onClick={onClear}
            className="hover:text-destructive size-7 shadow-sm"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>

        {pick}
      </div>
    )
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)

        const file = event.dataTransfer.files[0]
        if (file) upload.start(file)
      }}
      className={cn(
        'flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'bg-muted/40',
      )}
    >
      {failure ?? <Icon className="text-muted-foreground size-5" />}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
          className="h-7 gap-1.5 text-xs"
        >
          <UploadIcon className="size-3.5" />
          {t.library.editor.media.choose}
        </Button>

        {kind === 'audio' ? <RecordButton onRecorded={upload.start} t={t} /> : null}
      </div>

      <p className="text-muted-foreground text-xs">
        {t.library.editor.media.dropHint} · {t.library.editor.media.upTo}{' '}
        {megabytes(MAX_ASSET_BYTES[kind])} MB
      </p>

      {pick}
    </div>
  )
}

/**
 * A teacher reading the dialogue themselves, which for listening practice usually beats
 * anything they could find. Stopping uploads it straight away — a recording nobody keeps
 * costs a few hundred kilobytes, and a confirmation step before every take costs patience.
 */
function RecordButton({ onRecorded, t }: { onRecorded: (file: File) => void; t: Messages }) {
  const [recording, setRecording] = useState<Recording | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [denied, setDenied] = useState(false)

  // The server has no microphone and must not disagree with the browser about the first
  // paint. Read as external state with a server snapshot of "no", the way the dictation
  // block reads speech synthesis, so both sides render the same thing and it settles after.
  const canRecord = useSyncExternalStore(
    () => () => {},
    () => recordingSupported(),
    () => false,
  )

  // Held in a ref as well as in state: the permission prompt can still be open when this
  // component goes away — the step is switched, the block is deleted, a file is chosen
  // instead — and the recorder that arrives afterwards has to be given back, or the
  // browser's recording light stays on until the tab closes.
  const live = useRef<Recording | null>(null)
  const gone = useRef(false)

  useEffect(
    () => () => {
      gone.current = true
      live.current?.cancel()
      live.current = null
    },
    [],
  )

  useEffect(() => {
    if (!recording) return

    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)

    return () => clearInterval(timer)
  }, [recording])

  if (!canRecord) return null

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-destructive flex items-center gap-1.5 text-xs tabular-nums">
          <span className="bg-destructive size-2 animate-pulse rounded-full" />
          {clock(seconds)}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const current = live.current
            if (!current) return

            // Handed over to `stop`, which releases the microphone itself once the last
            // chunk is in. Clearing it first is what keeps the unmount cleanup from
            // cutting the recording short on its way out.
            live.current = null
            setRecording(null)

            void current
              .stop()
              .then((file) => {
                if (!gone.current) onRecorded(file)
              })
              .catch(() => {
                if (!gone.current) setDenied(true)
              })
          }}
          className="h-7 gap-1.5 text-xs"
        >
          <SquareIcon className="size-3 fill-current" />
          {t.library.editor.media.stop}
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        setDenied(false)
        setSeconds(0)

        void startRecording()
          .then((started) => {
            if (gone.current) {
              started.cancel()
              return
            }

            live.current = started
            setRecording(started)
          })
          .catch(() => {
            if (!gone.current) setDenied(true)
          })
      }}
      title={denied ? t.library.editor.media.micDenied : undefined}
      className={cn('h-7 gap-1.5 text-xs', denied && 'text-destructive')}
    >
      <MicIcon className="size-3.5" />
      {denied ? t.library.editor.media.micDenied : t.library.editor.media.record}
    </Button>
  )
}
