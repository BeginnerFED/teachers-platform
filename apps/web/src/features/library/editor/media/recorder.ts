/**
 * Recording a teacher's own voice, which for a listening exercise is often better than any
 * file they could find. MediaRecorder gives different containers on different browsers —
 * mp4/aac on Safari, webm/opus everywhere else — so the type is chosen from what the
 * browser admits to supporting rather than assumed, and both are types the audio block
 * accepts.
 */

/** mp4 first: it is the one every browser can also play back. */
const PREFERRED = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

const EXTENSION: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/webm': 'weba',
  'audio/ogg': 'ogg',
}

/** The container, without the codec parameters the file name has no use for. */
const baseType = (mimeType: string) => mimeType.split(';')[0] ?? mimeType

export function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    PREFERRED.some((type) => MediaRecorder.isTypeSupported(type))
  )
}

export type Recording = {
  stop: () => Promise<File>
  /** Give the microphone back without keeping anything. */
  cancel: () => void
}

/**
 * Asks for the microphone and starts recording. Resolves once the browser has actually
 * granted it, so a caller can show "recording" only when it is true; rejects if the person
 * says no, which the editor reports where the button was.
 */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = PREFERRED.find((type) => MediaRecorder.isTypeSupported(type))

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })

  // Every track, not just the first: the browser keeps the recording light on until the
  // last one is stopped, and a light that stays on after a lesson is a support ticket.
  const release = () => {
    for (const track of stream.getTracks()) track.stop()
  }

  recorder.start()

  return {
    stop: () =>
      new Promise<File>((resolve, reject) => {
        recorder.addEventListener(
          'stop',
          () => {
            release()

            const type = baseType(recorder.mimeType || mimeType || 'audio/webm')
            const blob = new Blob(chunks, { type })

            if (blob.size === 0) {
              reject(new Error('Nothing was recorded'))
              return
            }

            resolve(new File([blob], `recording.${EXTENSION[type] ?? 'weba'}`, { type }))
          },
          { once: true },
        )

        recorder.stop()
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      release()
    },
  }
}
