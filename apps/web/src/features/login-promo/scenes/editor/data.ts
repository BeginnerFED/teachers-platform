/**
 * The step being edited: 'Paying the bill', step 2 of the drafted lesson. Lesson content
 * is English and is data, not dictionary copy. The live scene teaches this same step.
 */
export const LESSON = {
  stepTitle: 'Paying the bill',
  prompt: 'Complete the dialogue.',
  /** As the teacher typed it: a dialogue with no gaps yet, so the block is not finished. */
  text: 'Could I have the bill, please?\nOf course. Would you like to pay by card?',
} as const

/** The words the teacher turns into gaps, in order. Each is also the pointer's anchor. */
export const GAP_WORDS = ['have', 'card'] as const

/** The raw text after the first `count` clicks: `[[have]]`, then `[[card]]` as well. */
export function rawText(count: number): string {
  return GAP_WORDS.slice(0, count).reduce<string>(
    (text, word) => text.replace(new RegExp(`\\b${word}\\b`), `[[${word}]]`),
    LESSON.text,
  )
}

export type Token =
  | { kind: 'text'; raw: string }
  | { kind: 'word'; raw: string }
  | { kind: 'gap'; raw: string; answers: string[] }

const GAP = /(\[\[[^\]]*\]\])/
const EDGES = /^([^\p{L}\p{N}']*)([\s\S]*?)([^\p{L}\p{N}']*)$/u

/**
 * The editor's own reading of the raw text (features/library/editor/gap-text.tsx):
 * gaps, words, and the punctuation and whitespace between them, kept outside the words.
 */
export function tokenise(raw: string): Token[] {
  const tokens: Token[] = []

  for (const part of raw.split(GAP)) {
    if (!part) continue

    if (part.startsWith('[[') && part.endsWith(']]')) {
      const answers = part
        .slice(2, -2)
        .split('|')
        .map((answer) => answer.trim())
        .filter(Boolean)
      tokens.push({ kind: 'gap', raw: part, answers })
      continue
    }

    for (const piece of part.split(/(\s+)/)) {
      if (!piece) continue
      if (/^\s+$/.test(piece)) {
        tokens.push({ kind: 'text', raw: piece })
        continue
      }

      const match = piece.match(EDGES)
      const [, before = '', core = piece, after = ''] = match ?? []
      if (before) tokens.push({ kind: 'text', raw: before })
      if (core) tokens.push({ kind: 'word', raw: core })
      if (after) tokens.push({ kind: 'text', raw: after })
    }
  }

  return tokens
}
