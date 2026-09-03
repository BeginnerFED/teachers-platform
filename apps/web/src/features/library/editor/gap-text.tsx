'use client'

import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { InlineTextarea } from './inline'

type Token =
  | { kind: 'text'; raw: string }
  | { kind: 'word'; raw: string }
  | { kind: 'gap'; raw: string; answers: string[] }

const GAP = /(\[\[[^\]]*\]\])/
const EDGES = /^([^\p{L}\p{N}']*)([\s\S]*?)([^\p{L}\p{N}']*)$/u

/**
 * A sentence with holes, edited by pointing at the words. Click a word and it becomes a
 * gap; click a gap and it is a word again. The raw `[[answer|other]]` text stays available
 * underneath for the cases pointing cannot express — a second accepted spelling — but the
 * author never has to type a bracket to make the ordinary case work.
 */
function tokenise(raw: string): Token[] {
  const tokens: Token[] = []

  for (const part of raw.split(GAP)) {
    if (!part) continue

    if (part.startsWith('[[') && part.endsWith(']]')) {
      const answers = part
        .slice(2, -2)
        .split('|')
        .map((a) => a.trim())
        .filter(Boolean)
      tokens.push({ kind: 'gap', raw: part, answers })
      continue
    }

    // Words and the whitespace between them, with punctuation kept outside the word so
    // that clicking "know." turns "know" into the gap and leaves the full stop where it is.
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

export function GapText({
  value,
  onChange,
  placeholder,
  t,
}: {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  t: Messages
}) {
  const tokens = tokenise(value)

  const replaceToken = (index: number, raw: string) =>
    onChange(tokens.map((token, i) => (i === index ? raw : token.raw)).join(''))

  return (
    <div className="grid gap-2">
      {/* The sentence as the student sees it, with the gaps drawn as the player draws
          them — and every word a button. */}
      {tokens.length > 0 ? (
        <p className="text-[15px] leading-[2.4]">
          {tokens.map((token, index) => {
            if (token.kind === 'text') {
              return (
                <span key={index} className="whitespace-pre-wrap">
                  {token.raw}
                </span>
              )
            }

            if (token.kind === 'word') {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => replaceToken(index, `[[${token.raw}]]`)}
                  title={t.library.editor.fields.clickToGap}
                  className="hover:decoration-primary hover:bg-primary/5 rounded px-0.5 underline decoration-transparent decoration-dotted underline-offset-4 transition-colors"
                >
                  {token.raw}
                </button>
              )
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => replaceToken(index, token.answers[0] ?? '')}
                title={t.library.editor.fields.remove}
                className={cn(
                  'border-primary hover:bg-primary/10 mx-1 inline-block min-w-[6ch] border-b-2 px-1 text-center transition-colors',
                  token.answers.length === 0 && 'border-destructive',
                )}
              >
                {token.answers[0] ?? '·'}
                {token.answers.length > 1 ? (
                  <span className="text-muted-foreground text-xs">
                    {' '}
                    +{token.answers.length - 1}
                  </span>
                ) : null}
              </button>
            )
          })}
        </p>
      ) : null}

      <InlineTextarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={tokens.length > 0 ? 1 : 2}
        className="text-muted-foreground font-mono text-xs"
      />

      <p className="text-muted-foreground text-xs">
        {t.library.editor.fields.clickToGap} {t.library.editor.fields.gapHint}
      </p>
    </div>
  )
}
