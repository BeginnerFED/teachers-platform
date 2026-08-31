/**
 * Time as an injected dependency. Every rule that compares dates — how much of a
 * subscription is left, whether it has run out — takes one of these, so a test can pin
 * "now" to a fixed instant instead of trying to reason about the real clock.
 */
export type Clock = {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date(),
}
