'use client'

import { useState } from 'react'
import { RefreshCwIcon, Volume2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { hashString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { ExerciseShell } from '../../blocks/shell'
import { TONE_CLASS } from '../../blocks/types'
import { newId, segmentsToText, textToSegments, type EditorProps } from '../block-defaults'
import { AddRow, RemoveRow } from '../fields'
import { GapText } from '../gap-text'
import { InlineText, InlineTextarea, SettingNumber, SettingToggle, Settings } from '../inline'
import { generateWordSearch, normaliseWord } from '../word-search'

/** The games, as the author writes them: the player's own frame with the words typed in. */

export function MemoryMatchEditor({ draft, onChange, t }: EditorProps<'memory_match'>) {
  const pairs = draft.pairs ?? []

  const set = (id: string, patch: Partial<(typeof pairs)[number]>) =>
    onChange({ pairs: pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  return (
    <ExerciseShell
      label={t.library.blocks.memory}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
    >
      {/* Both cards of every pair face up, side by side, the way the student will see
          them once found. */}
      <ul className="space-y-2">
        {pairs.map((pair) => (
          <li key={pair.id} className="grid grid-cols-[1fr_1fr_auto] items-stretch gap-2">
            <div className="flex items-center justify-center rounded-md border p-3 text-center text-sm">
              <InlineText
                value={pair.a}
                onChange={(a) => set(pair.id, { a })}
                placeholder={t.library.editor.fields.pairA}
                maxLength={60}
                className="text-center"
              />
            </div>
            <div className="flex items-center justify-center rounded-md border p-3 text-center text-sm">
              <InlineText
                value={pair.b}
                onChange={(b) => set(pair.id, { b })}
                placeholder={t.library.editor.fields.pairB}
                maxLength={60}
                className="text-center"
              />
            </div>
            <div className="flex items-center">
              <RemoveRow
                label={t.library.editor.fields.remove}
                disabled={pairs.length <= 2}
                onClick={() => onChange({ pairs: pairs.filter((p) => p.id !== pair.id) })}
              />
            </div>
          </li>
        ))}
      </ul>

      {pairs.length < 12 ? (
        <AddRow
          className="mt-2"
          onClick={() => onChange({ pairs: [...pairs, { id: newId(), a: '', b: '' }] })}
        >
          {t.library.editor.fields.addPair}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}

export function WordSearchEditor({ draft, onChange, t }: EditorProps<'word_search'>) {
  // What is being typed, one row per word; what is stored is the normalised, non-empty
  // subset. A row being typed into must not vanish for being empty.
  const [rows, setRows] = useState<string[]>(() => (draft.words?.length ? draft.words : ['']))
  const [nonce, setNonce] = useState(0)

  const size = draft.size ?? 10
  const placements = draft.placements ?? []
  const grid = draft.grid ?? []

  const rebuild = (nextRows: string[], nextSize: number, nextNonce: number) => {
    const words = [...new Set(nextRows.map(normaliseWord).filter((w) => w.length >= 2))]
    const built =
      words.length > 0
        ? generateWordSearch(
            words,
            nextSize,
            hashString(words.join('|')) + nextSize * 7919 + nextNonce,
          )
        : null

    onChange({
      words,
      size: nextSize,
      grid: built?.grid ?? [],
      placements: built?.placements ?? [],
    })
  }

  const placed = new Set(placements.flatMap((p) => p.cells.map((c) => `${c.r},${c.c}`)))
  const failed = (draft.words?.length ?? 0) > 0 && grid.length === 0

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingNumber
          label={t.library.editor.fields.gridSize}
          value={size}
          min={6}
          max={16}
          onChange={(next) => rebuild(rows, Math.min(16, Math.max(6, next ?? 10)), nonce)}
        />
        <button
          type="button"
          onClick={() => {
            setNonce(nonce + 1)
            rebuild(rows, size, nonce + 1)
          }}
          className="hover:text-foreground flex items-center gap-1"
        >
          <RefreshCwIcon className="size-3" />
          {t.library.editor.fields.regenerate}
        </button>
      </Settings>

      <ExerciseShell
        label={t.library.blocks.wordSearch}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt: prompt || undefined })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* The puzzle as the student gets it, with the answer lit up for the author. */}
          {grid.length > 0 ? (
            <div
              className="grid w-fit gap-0.5"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {grid.map((row, r) =>
                row.map((letter, c) => (
                  <div
                    key={`${r},${c}`}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-sm border text-xs font-medium uppercase sm:size-8 sm:text-sm',
                      placed.has(`${r},${c}`)
                        ? 'border-emerald-500/60 bg-emerald-500/15'
                        : 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {letter}
                  </div>
                )),
              )}
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-32 flex-1 items-center justify-center rounded-md border border-dashed p-4 text-center text-xs">
              {failed ? t.library.editor.fields.gridTooSmall : t.library.editor.fields.words}
            </div>
          )}

          <div className="flex min-w-40 flex-col gap-1.5">
            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              {t.library.editor.fields.words}
            </p>

            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-1">
                <InlineText
                  value={row}
                  onChange={(next) => {
                    const upper = next.toUpperCase()
                    const nextRows = rows.map((r, i) => (i === index ? upper : r))
                    setRows(nextRows)
                    rebuild(nextRows, size, nonce)
                  }}
                  placeholder={t.library.editor.fields.addWord}
                  maxLength={12}
                  className="font-mono text-sm uppercase"
                />
                <RemoveRow
                  label={t.library.editor.fields.remove}
                  disabled={rows.length <= 1}
                  className="size-5"
                  onClick={() => {
                    const nextRows = rows.filter((_, i) => i !== index)
                    setRows(nextRows)
                    rebuild(nextRows, size, nonce)
                  }}
                />
              </div>
            ))}

            {rows.length < 12 ? (
              <AddRow onClick={() => setRows([...rows, ''])}>
                {t.library.editor.fields.addWord}
              </AddRow>
            ) : null}
          </div>
        </div>
      </ExerciseShell>
    </div>
  )
}

export function DialogueOrderEditor({ draft, onChange, t }: EditorProps<'dialogue_order'>) {
  const lines = draft.lines ?? []

  const set = (id: string, patch: Partial<(typeof lines)[number]>) =>
    onChange({ lines: lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })

  return (
    <ExerciseShell
      label={t.library.blocks.dialogue}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
      hint={t.library.blocks.dialogueHint}
    >
      {/* Written in the order it is spoken; the student gets it shuffled. */}
      <ol className="flex flex-col gap-1.5">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              TONE_CLASS.idle,
            )}
          >
            <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
              {index + 1}
            </span>
            <InlineText
              value={line.speaker}
              onChange={(speaker) => set(line.id, { speaker })}
              placeholder={t.library.editor.fields.speaker}
              maxLength={40}
              className="w-28 shrink-0 font-semibold"
            />
            <InlineText
              value={line.text}
              onChange={(text) => set(line.id, { text })}
              placeholder={t.library.editor.fields.line}
              maxLength={300}
            />
            <RemoveRow
              label={t.library.editor.fields.remove}
              disabled={lines.length <= 2}
              onClick={() => onChange({ lines: lines.filter((l) => l.id !== line.id) })}
            />
          </li>
        ))}
      </ol>

      {lines.length < 12 ? (
        <AddRow
          className="mt-2"
          onClick={() =>
            onChange({
              lines: [...lines, { id: newId(), speaker: lines.at(-2)?.speaker ?? '', text: '' }],
            })
          }
        >
          {t.library.editor.fields.addLine}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}

export function DictationEditor({ draft, onChange, t }: EditorProps<'dictation'>) {
  const [speaking, setSpeaking] = useState(false)

  const listen = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !draft.text) return

    const utterance = new SpeechSynthesisUtterance(draft.text)
    utterance.lang = 'en-US'
    utterance.rate = draft.rate ?? 0.9
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingNumber
          label={t.library.editor.fields.rate}
          value={draft.rate ?? 0.9}
          min={0.5}
          max={1.2}
          step={0.1}
          onChange={(rate) => onChange({ rate: rate ?? 0.9 })}
        />
        <SettingNumber
          label={`${t.library.editor.fields.plays} (0 = ${t.library.editor.fields.unlimited})`}
          value={draft.plays ?? 3}
          min={0}
          max={10}
          onChange={(plays) => onChange({ plays: plays ?? 3 })}
        />
      </Settings>

      <ExerciseShell
        label={t.library.blocks.dictation}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt: prompt || undefined })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
      >
        {/* What the voice will say — the one thing the student never reads. */}
        <InlineTextarea
          value={draft.text ?? ''}
          onChange={(text) => onChange({ text })}
          placeholder={t.library.editor.fields.dictationText}
          maxLength={500}
          className="mb-3 text-[15px] leading-relaxed"
        />

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={speaking || !draft.text}
            onClick={listen}
            className="corner-brackets gap-2"
          >
            <Volume2Icon className={cn('size-4', speaking && 'animate-pulse')} />
            {t.library.blocks.listen}
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {draft.plays
              ? `${draft.plays} ${t.library.blocks.listensLeft}`
              : t.library.editor.fields.unlimited}
          </span>
        </div>

        <Textarea
          disabled
          placeholder={t.library.blocks.dictationPlaceholder}
          rows={3}
          className="resize-none"
        />
      </ExerciseShell>
    </div>
  )
}

export function SpeedRoundEditor({ draft, onChange, t }: EditorProps<'speed_round'>) {
  const items = draft.items ?? []
  // Raw text per item, for the same reason the gap-fill keeps it: the half-typed marker.
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, segmentsToText(item.segments)])),
  )

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingNumber
          label={t.library.editor.fields.secondsPerItem}
          value={draft.secondsPerItem ?? 10}
          min={5}
          max={60}
          onChange={(seconds) => onChange({ secondsPerItem: seconds ?? 10 })}
        />
        <SettingToggle
          label={t.library.editor.fields.caseSensitive}
          checked={draft.caseSensitive ?? false}
          onChange={(caseSensitive) => onChange({ caseSensitive })}
        />
      </Settings>

      <ExerciseShell
        label={t.library.blocks.speedRound}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt: prompt || undefined })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
      >
        <ol className="space-y-3">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-start gap-2 rounded-md border p-3">
              <span className="text-muted-foreground mt-2 w-4 shrink-0 text-xs tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <GapText
                  value={raw[item.id] ?? ''}
                  onChange={(next) => {
                    setRaw({ ...raw, [item.id]: next })
                    onChange({
                      items: items.map((i) =>
                        i.id === item.id ? { ...i, segments: textToSegments(next) } : i,
                      ),
                    })
                  }}
                  placeholder={t.library.editor.fields.gapText}
                  t={t}
                />
              </div>
              <RemoveRow
                label={t.library.editor.fields.remove}
                disabled={items.length <= 1}
                onClick={() => onChange({ items: items.filter((i) => i.id !== item.id) })}
              />
            </li>
          ))}
        </ol>

        {items.length < 20 ? (
          <AddRow
            className="mt-2"
            onClick={() => onChange({ items: [...items, { id: newId(), segments: [] }] })}
          >
            {t.library.editor.fields.addItem}
          </AddRow>
        ) : null}
      </ExerciseShell>
    </div>
  )
}
