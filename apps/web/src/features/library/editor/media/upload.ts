/**
 * Putting the bytes where the ticket says. This is the one place in the web app that talks
 * to something other than our own server, and it is deliberate: routing a 20 MB recording
 * through a server action would hit its body limit, and routing it through the API would
 * mean holding the file in memory twice for no gain.
 *
 * XHR rather than fetch, only because fetch still cannot report upload progress — and a
 * progress bar is the difference between "it is working" and "it is broken".
 */
export function putFile(
  uploadUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): { done: Promise<void>; abort: () => void } {
  const request = new XMLHttpRequest()

  const done = new Promise<void>((resolve, reject) => {
    request.open('PUT', uploadUrl, true)
    // The signed URL pins the path, not the type; this is what the stored object is served
    // back as, so an <audio> element knows what it has been given.
    request.setRequestHeader('content-type', file.type || 'application/octet-stream')

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    })

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1)
        resolve()
      } else {
        reject(new Error(`Upload failed with ${request.status}`))
      }
    })

    request.addEventListener('error', () => reject(new Error('Upload failed')))
    request.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    request.send(file)
  })

  return { done, abort: () => request.abort() }
}
