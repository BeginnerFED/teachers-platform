'use client'

import { useState } from 'react'
import { ArrowRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExerciseShell } from '../../blocks/shell'
import { TONE_CLASS } from '../../blocks/types'
import { newId, splitWords, type EditorProps } from '../block-defaults'
import { AddRow, RemoveRow } from '../fields'
import { InlineText } from '../inline'

/** The blocks answered by putting things in order or in groups, drawn as the player draws them. */

export function MatchingEditor({ draft, onChange, t }: EditorProps<'matching'>) {
  const pairs = draft.pairs ?? []

  const set = (id: string, patch: Partial<(typeof pairs)[number]>) =>
    onChange({ pairs: pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  return (
    <ExerciseShell
      label={t.library.blocks.matchPairs}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
      hint={t.library.blocks.matchHint}
    >
      {/* The two columns the student gets, pair by pair, with the answer drawn between
          them — which is the one thing the student never sees. */}
      <ul className="space-y-2">
        {pairs.map((pair) => (
          <li key={pair.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <div className={cn('rounded-md border p-3 text-sm', TONE_CLASS.idle)}>
              <InlineText
                value={pair.left}
                onChange={(left) => set(pair.id, { left })}
                placeholder={t.library.editor.fields.left}
                maxLength={200}
                className="font-medium"
              />
            </div>

            <ArrowRightIcon className="text-muted-foreground size-3.5" />

            <div className={cn('rounded-md border px-3 py-2 text-sm', TONE_CLASS.idle)}>
              <InlineText
                value={pair.right}
                onChange={(right) => set(pair.id, { right })}
                placeholder={t.library.editor.fields.right}
                maxLength={200}
              />
            </div>

            <RemoveRow
              label={t.library.editor.fields.remove}
              disabled={pairs.length <= 2}
              onClick={() => onChange({ pairs: pairs.filter((p) => p.id !== pair.id) })}
            />
          </li>
        ))}
      </ul>

      {pairs.length < 10 ? (
        <AddRow
          className="mt-2"
          onClick={() => onChange({ pairs: [...pairs, { id: newId(), left: '', right: '' }] })}
        >
          {t.library.editor.fields.addPair}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}

export function CategorizeEditor({ draft, onChange, t }: EditorProps<'categorize'>) {
  const categories = draft.categories ?? []
  const items = draft.items ?? []

  return (
    <ExerciseShell
      label={t.library.blocks.categorise}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
      hint={t.library.blocks.categoriseHint}
    >
      {/* The boxes the student sorts into, each already holding what belongs in it. An
          item is added inside its box, which is how it gets its category — no dropdown. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => {
          const inside = items.filter((item) => item.categoryId === category.id)

          return (
            <div
              key={category.id}
              className="group/category relative min-h-24 rounded-md border p-3"
            >
              <div className="mb-2 flex items-center gap-1">
                <InlineText
                  value={category.label}
                  onChange={(label) =>
                    onChange({
                      categories: categories.map((c) =>
                        c.id === category.id ? { ...c, label } : c,
                      ),
                    })
                  }
                  placeholder={t.library.editor.fields.category}
                  maxLength={80}
                  className="text-muted-foreground text-xs font-medium uppercase tracking-wide"
                />
                <RemoveRow
                  label={t.library.editor.fields.remove}
                  disabled={categories.length <= 2}
                  className="opacity-0 focus-visible:opacity-100 group-hover/category:opacity-100 max-sm:opacity-100"
                  onClick={() =>
                    onChange({
                      categories: categories.filter((c) => c.id !== category.id),
                      items: items.filter((i) => i.categoryId !== category.id),
                    })
                  }
                />
              </div>

              <ul className="flex flex-col gap-1.5">
                {inside.map((item) => (
                  <li
                    key={item.id}
                    className="border-border bg-background flex items-center gap-1 rounded border px-2 py-1 text-xs"
                  >
                    <InlineText
                      value={item.text}
                      onChange={(text) =>
                        onChange({
                          items: items.map((i) => (i.id === item.id ? { ...i, text } : i)),
                        })
                      }
                      placeholder={t.library.editor.fields.items}
                      maxLength={200}
                    />
                    <RemoveRow
                      label={t.library.editor.fields.remove}
                      className="size-5"
                      onClick={() => onChange({ items: items.filter((i) => i.id !== item.id) })}
                    />
                  </li>
                ))}
              </ul>

              {items.length < 20 ? (
                <AddRow
                  className="mt-1"
                  onClick={() =>
                    onChange({
                      items: [...items, { id: newId(), text: '', categoryId: category.id }],
                    })
                  }
                >
                  {t.library.editor.fields.addItem}
                </AddRow>
              ) : null}
            </div>
          )
        })}
      </div>

      {categories.length < 5 ? (
        <AddRow
          className="mt-2"
          onClick={() => onChange({ categories: [...categories, { id: newId(), label: '' }] })}
        >
          {t.library.editor.fields.addCategory}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}

export function SentenceBuilderEditor({ draft, onChange, t }: EditorProps<'sentence_builder'>) {
  // Raw text kept locally for the same reason as the gap-fill: the words are what is
  // saved, but a trailing space is what is being typed.
  const [sentence, setSentence] = useState(() => (draft.correct ?? []).join(' '))
  const [distractors, setDistractors] = useState(() => (draft.distractors ?? []).join(' '))

  const words = draft.correct ?? []
  const extras = draft.distractors ?? []

  return (
    <ExerciseShell
      label={t.library.blocks.buildSentence}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
      hint={t.library.blocks.buildHint}
    >
      {/* The sentence, and then the pieces the student will be handed — the same chips
          the player deals out, with the extras drawn dashed so they can be told apart. */}
      <InlineText
        value={sentence}
        onChange={(next) => {
          setSentence(next)
          onChange({ correct: splitWords(next) })
        }}
        placeholder={t.library.editor.fields.sentenceHint}
        className="text-[15px]"
      />

      {words.length > 0 || extras.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {words.map((word, index) => (
            <li
              key={`${word}-${index}`}
              className={cn('rounded-md border px-2.5 py-1.5 text-sm', TONE_CLASS.idle)}
            >
              {word}
            </li>
          ))}
          {extras.map((word, index) => (
            <li
              key={`x-${word}-${index}`}
              className="text-muted-foreground rounded-md border border-dashed px-2.5 py-1.5 text-sm"
            >
              {word}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 border-t pt-3">
        <InlineText
          value={distractors}
          onChange={(next) => {
            setDistractors(next)
            onChange({ distractors: splitWords(next) })
          }}
          placeholder={`${t.library.editor.fields.distractors} — ${t.library.editor.fields.distractorsHint}`}
          className="text-muted-foreground text-sm"
        />
      </div>
    </ExerciseShell>
  )
}

export function FlashcardsEditor({ draft, onChange, t }: EditorProps<'flashcards'>) {
  const cards = draft.cards ?? []

  const set = (id: string, patch: Partial<(typeof cards)[number]>) =>
    onChange({ cards: cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  return (
    <ExerciseShell
      label={t.library.blocks.flashcards}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
    >
      {/* Every card with both faces up — the front as the student first sees it, the back
          as it flips to — since the author needs both at once. */}
      <ul className="space-y-2">
        {cards.map((card, index) => (
          <li key={card.id} className="grid grid-cols-[1fr_1fr_auto] items-stretch gap-2">
            <div className="bg-muted/30 flex flex-col justify-center rounded-lg border p-4 text-center">
              <InlineText
                value={card.front}
                onChange={(front) => set(card.id, { front })}
                placeholder={t.library.editor.fields.front}
                maxLength={200}
                className="text-center text-lg font-medium"
              />
            </div>

            <div className="bg-muted/30 flex flex-col justify-center gap-1 rounded-lg border p-4 text-center">
              <InlineText
                value={card.back}
                onChange={(back) => set(card.id, { back })}
                placeholder={t.library.editor.fields.back}
                maxLength={400}
                className="text-center text-lg font-medium"
              />
              <InlineText
                value={card.hint ?? ''}
                onChange={(hint) => set(card.id, { hint: hint || undefined })}
                placeholder={t.library.editor.fields.hint}
                maxLength={200}
                className="text-muted-foreground text-center text-xs"
              />
            </div>

            <div className="flex flex-col items-center justify-between py-1">
              <span className="text-muted-foreground text-xs tabular-nums">{index + 1}</span>
              <RemoveRow
                label={t.library.editor.fields.remove}
                disabled={cards.length <= 1}
                onClick={() => onChange({ cards: cards.filter((c) => c.id !== card.id) })}
              />
            </div>
          </li>
        ))}
      </ul>

      {cards.length < 40 ? (
        <AddRow
          className="mt-2"
          onClick={() => onChange({ cards: [...cards, { id: newId(), front: '', back: '' }] })}
        >
          {t.library.editor.fields.addCard}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}
