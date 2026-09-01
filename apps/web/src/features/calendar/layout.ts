export type Interval = { start: number; end: number }

export type Placed<Item> = {
  item: Item
  /** Which column within the day, counting from the left. */
  lane: number
  /** How many columns the day is split into at this point. */
  lanes: number
}

/**
 * Works out where lessons that share a time can sit without covering each other.
 *
 * An admin's calendar shows every teacher at once, so two lessons at nine o'clock are the
 * normal case rather than the exception. Each one takes a share of the width, and the
 * share is decided per cluster of mutually overlapping lessons rather than per day —
 * otherwise one busy hour on Monday morning would shrink every lesson on Monday.
 *
 * Pure and self-contained so it can be reasoned about on its own; the grid only has to
 * multiply by a width.
 */
export function packOverlapping<Item>(
  items: Item[],
  toInterval: (item: Item) => Interval,
): Placed<Item>[] {
  const sorted = [...items].sort((a, b) => {
    const first = toInterval(a)
    const second = toInterval(b)

    // Longer first when two start together, so the wider block takes the left lane and
    // the column order matches what the eye expects.
    return first.start - second.start || second.end - first.end
  })

  const placed: Placed<Item>[] = []
  let cluster: Placed<Item>[] = []
  let laneEnds: number[] = []
  let clusterEnd = -Infinity

  function flush() {
    for (const entry of cluster) entry.lanes = laneEnds.length
    placed.push(...cluster)
    cluster = []
    laneEnds = []
    clusterEnd = -Infinity
  }

  for (const item of sorted) {
    const { start, end } = toInterval(item)

    // Nothing in the cluster is still running, so the next one starts a fresh division of
    // the width rather than inheriting a crowd it has nothing to do with.
    if (start >= clusterEnd) flush()

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }

    cluster.push({ item, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, end)
  }

  flush()

  return placed
}
