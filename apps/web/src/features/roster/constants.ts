/**
 * Radix cannot hold an empty value, so "nobody yet" is a real option with a sentinel the
 * action turns back into nothing. In its own module because the field is client code and
 * the action is server code, and a value crossing that line from either side is a
 * reference, not a string.
 */
export const NO_TEACHER = 'none'
