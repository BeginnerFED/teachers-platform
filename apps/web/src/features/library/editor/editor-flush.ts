/**
 * A hand-off between the editor and the controls that live outside it — the preview
 * button in the page header, kept there so the page keeps the same skeleton as every
 * other page. Before navigating away, those controls ask the editor to send whatever it
 * is still holding, and wait for it.
 *
 * A module-level slot rather than context, because there is one editor on a page and
 * threading a provider through a server-rendered header for a single function is more
 * machinery than the job is worth.
 */
let pending: (() => Promise<void>) | null = null

/**
 * Uploads in flight. A file is slower than anything else the editor does, and the block
 * only learns its id when it lands — so leaving before then would leave a picture behind.
 */
const uploads = new Set<Promise<unknown>>()

export function setPendingFlush(flush: (() => Promise<void>) | null) {
  pending = flush
}

/**
 * Registers an upload, from asking for a ticket to patching the block that will point at
 * it — the whole chain, so that when it settles the block really does know the file.
 */
export function trackUpload<T>(work: Promise<T>): Promise<T> {
  uploads.add(work)

  const forget = () => {
    uploads.delete(work)
  }
  work.then(forget, forget)

  return work
}

export async function flushPendingSaves(): Promise<void> {
  // Files first. An autosave that runs while a picture is still going up saves a block
  // that does not have one yet, and the save after it would never come.
  while (uploads.size > 0) await Promise.allSettled([...uploads])

  if (pending) await pending()
}
