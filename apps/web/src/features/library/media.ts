/**
 * Where a lesson's files are fetched from. One function, because the editor and the player
 * both point at them and a second spelling of this path would be a second thing to keep
 * right.
 *
 * Never a storage URL: that route checks who is asking before it sends anyone anywhere.
 */
export function mediaSrc(assetId: string): string {
  return `/media/${assetId}`
}
