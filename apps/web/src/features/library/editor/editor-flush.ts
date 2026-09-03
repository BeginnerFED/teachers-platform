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

export function setPendingFlush(flush: (() => Promise<void>) | null) {
  pending = flush
}

export function flushPendingSaves(): Promise<void> {
  return pending ? pending() : Promise.resolve()
}
