'use client'

import { useState } from 'react'
import { RefreshCwIcon } from 'lucide-react'
import { ExerciseShell } from '../../blocks/shell'
import { newId, splitWords, type EditorProps } from '../block-defaults'
import { generateCrossword } from '../crossword'
import { AddRow, RemoveRow } from '../fields'
import { InlineText, InlineTextarea, SettingNumber, Settings } from '../inline'
import { WordPicker } from '../word-picker'
import { normaliseWord } from '../word-search'

/** The second set of games, as the author writes them. */

export function HangmanEditor({ draft, onChange, t }: EditorProps<'hangman'>) {
  const word = draft.word ?? ''

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingNumber
          label={t.library.editor.fields.maxMisses}
          value={draft.maxMisses ?? 6}
          min={3}
          max={10}
          onChange={(maxMisses) => onChange({ maxMisses: maxMisses ?? 6 })}
        />
      </Settings>

      <ExerciseShell
        label={t.library.blocks.hangman}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt: prompt || undefined })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
        hint={
          <InlineText
            value={draft.hint ?? ''}
            onChange={(hint) => onChange({ hint: hint || undefined })}
            placeholder={t.library.editor.fields.hint}
            maxLength={120}
          />
        }
      >
        {/* The word as its boxes, filled in for the author. */}
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          {[...(word || '·')].map((letter, index) => (
            <span
              key={index}
              className="border-foreground/60 flex size-9 items-center justify-center rounded-md border-b-2 text-lg font-semibold uppercase"
            >
              {letter}
            </span>
          ))}
        </div>

        <InlineText
          value={word}
          onChange={(next) => onChange({ word: normaliseWord(next) })}
          placeholder={t.library.editor.fields.word}
          maxLength={15}
          className="text-center font-mono text-sm uppercase tracking-widest"
        />
      </ExerciseShell>
    </div>
  )
}

export function AnagramEditor({ draft, onChange, t }: EditorProps<'anagram'>) {
  const items = draft.items ?? []

  const set = (id: string, patch: Partial<(typeof items)[number]>) =>
    onChange({ items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })

  return (
    <ExerciseShell
      label={t.library.blocks.anagram}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
      hint={t.library.blocks.anagramHint}
    >
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            {/* The word's letters as the tiles the student will be dealt — in order here,
                since the server does the shuffling. */}
            <div className="flex flex-wrap gap-1">
              {[...(item.word || '·')].map((letter, index) => (
                <span
                  key={index}
                  className="border-border flex size-8 items-center justify-center rounded-md border text-sm font-medium uppercase"
                >
                  {letter}
                </span>
              ))}
            </div>
            <InlineText
              value={item.word}
              onChange={(word) => set(item.id, { word: word.replace(/[^A-Za-z'-]/g, '') })}
              placeholder={t.library.editor.fields.word}
              maxLength={20}
              className="w-32 shrink-0 font-mono text-sm"
            />
            <InlineText
              value={item.hint ?? ''}
              onChange={(hint) => set(item.id, { hint: hint || undefined })}
              placeholder={t.library.editor.fields.hint}
              maxLength={120}
              className="text-muted-foreground text-sm"
            />
            <RemoveRow
              label={t.library.editor.fields.remove}
              disabled={items.length <= 1}
              onClick={() => onChange({ items: items.filter((i) => i.id !== item.id) })}
            />
          </li>
        ))}
      </ul>

      {items.length < 12 ? (
        <AddRow
          className="mt-2"
          onClick={() => onChange({ items: [...items, { id: newId(), word: '' }] })}
        >
          {t.library.editor.fields.addWord}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}

export function SpotMistakeEditor({ draft, onChange, t }: EditorProps<'spot_mistake'>) {
  const items = draft.items ?? []
  // The sentence as typed, per item: the words are what is saved, the trailing space is
  // what is being typed.
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.words.join(' ')])),
  )

  const set = (id: string, patch: Partial<(typeof items)[number]>) =>
    onChange({ items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })

  return (
    <ExerciseShell
      label={t.library.blocks.spotMistake}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
      hint={t.library.editor.fields.clickWrong}
    >
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <InlineText
                  value={raw[item.id] ?? ''}
                  onChange={(next) => {
                    setRaw({ ...raw, [item.id]: next })
                    const words = splitWords(next)
                    set(item.id, {
                      words,
                      wrongIndex: item.wrongIndex < words.length ? item.wrongIndex : -1,
                    })
                  }}
                  placeholder={t.library.editor.fields.sentence}
                  maxLength={400}
                  className="text-sm"
                />

                {item.words.length > 0 ? (
                  <WordPicker
                    words={item.words}
                    selected={item.wrongIndex >= 0 ? [item.wrongIndex] : []}
                    onToggle={(index) =>
                      set(item.id, { wrongIndex: item.wrongIndex === index ? -1 : index })
                    }
                    tone="destructive"
                    className="mt-1"
                  />
                ) : null}

                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground text-xs">
                    {t.library.editor.fields.correction}:
                  </span>
                  <InlineText
                    value={item.correction}
                    onChange={(correction) => set(item.id, { correction })}
                    placeholder={item.words[item.wrongIndex] ?? '…'}
                    maxLength={60}
                    className="text-emerald-700 dark:text-emerald-300"
                  />
                </div>
              </div>

              <RemoveRow
                label={t.library.editor.fields.remove}
                disabled={items.length <= 1}
                onClick={() => onChange({ items: items.filter((i) => i.id !== item.id) })}
              />
            </div>
          </li>
        ))}
      </ul>

      {items.length < 10 ? (
        <AddRow
          className="mt-2"
          onClick={() =>
            onChange({
              items: [...items, { id: newId(), words: [], wrongIndex: -1, correction: '' }],
            })
          }
        >
          {t.library.editor.fields.addItem}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}

export function HighlightWordsEditor({ draft, onChange, t }: EditorProps<'highlight_words'>) {
  const [raw, setRaw] = useState(() => (draft.words ?? []).join(' '))
  const words = draft.words ?? []
  const targets = draft.targets ?? []

  return (
    <ExerciseShell
      label={t.library.blocks.highlight}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
      hint={t.library.editor.fields.clickTargets}
    >
      <InlineTextarea
        value={raw}
        onChange={(next) => {
          setRaw(next)
          const nextWords = splitWords(next)
          onChange({ words: nextWords, targets: targets.filter((i) => i < nextWords.length) })
        }}
        placeholder={t.library.editor.fields.passage}
        maxLength={4000}
        rows={2}
        className="text-muted-foreground mb-3 text-sm"
      />

      {words.length > 0 ? (
        <WordPicker
          words={words}
          selected={targets}
          onToggle={(index) =>
            onChange({
              targets: targets.includes(index)
                ? targets.filter((i) => i !== index)
                : [...targets, index].sort((a, b) => a - b),
            })
          }
        />
      ) : null}
    </ExerciseShell>
  )
}

export function CrosswordEditor({ draft, onChange, t }: EditorProps<'crossword'>) {
  const entries = draft.entries ?? []
  const placements = draft.placements ?? []
  const size = draft.size ?? 5

  const rebuild = (nextEntries: typeof entries) => {
    const built = generateCrossword(nextEntries.filter((e) => e.answer.length >= 2))
    onChange({
      entries: nextEntries,
      size: built?.size ?? 5,
      placements: built?.placements ?? [],
    })
  }

  const set = (id: string, patch: Partial<(typeof entries)[number]>) =>
    rebuild(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  // The board, with letters, for the author.
  const letters = new Map<string, string>()
  for (const p of placements) {
    const entry = entries.find((e) => e.id === p.id)
    if (!entry) continue
    ;[...entry.answer].forEach((letter, i) => {
      letters.set(
        `${p.dir === 'down' ? p.r + i : p.r},${p.dir === 'across' ? p.c + i : p.c}`,
        letter,
      )
    })
  }

  const ready = entries.filter((e) => e.answer.length >= 2).length
  const failed = ready >= 2 && placements.length === 0

  return (
    <div className="grid gap-2">
      <Settings>
        <button
          type="button"
          onClick={() => rebuild(entries)}
          className="hover:text-foreground flex items-center gap-1"
        >
          <RefreshCwIcon className="size-3" />
          {t.library.editor.fields.regenerate}
        </button>
      </Settings>

      <ExerciseShell
        label={t.library.blocks.crossword}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt: prompt || undefined })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {placements.length > 0 ? (
            <div
              className="grid w-fit shrink-0 gap-px"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: size * size }, (_, index) => {
                const key = `${Math.floor(index / size)},${index % size}`
                const letter = letters.get(key)

                return letter ? (
                  <span
                    key={key}
                    className="border-border bg-background flex size-7 items-center justify-center rounded-sm border text-sm font-semibold uppercase sm:size-8"
                  >
                    {letter}
                  </span>
                ) : (
                  <span key={key} className="size-7 sm:size-8" />
                )
              })}
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-32 flex-1 items-center justify-center rounded-md border border-dashed p-4 text-center text-xs">
              {failed ? t.library.editor.fields.crosswordTooTight : t.library.editor.fields.words}
            </div>
          )}

          <ul className="min-w-0 flex-1 space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2">
                <InlineText
                  value={entry.answer}
                  onChange={(answer) => set(entry.id, { answer: normaliseWord(answer) })}
                  placeholder={t.library.editor.fields.answer}
                  maxLength={15}
                  className="w-32 shrink-0 font-mono text-sm uppercase tracking-wider"
                />
                <InlineText
                  value={entry.clue}
                  onChange={(clue) => set(entry.id, { clue })}
                  placeholder={t.library.editor.fields.clue}
                  maxLength={200}
                  className="text-sm"
                />
                <RemoveRow
                  label={t.library.editor.fields.remove}
                  disabled={entries.length <= 2}
                  onClick={() => rebuild(entries.filter((e) => e.id !== entry.id))}
                />
              </li>
            ))}

            {entries.length < 15 ? (
              <li>
                <AddRow
                  onClick={() => rebuild([...entries, { id: newId(), answer: '', clue: '' }])}
                >
                  {t.library.editor.fields.addWord}
                </AddRow>
              </li>
            ) : null}
          </ul>
        </div>
      </ExerciseShell>
    </div>
  )
}
