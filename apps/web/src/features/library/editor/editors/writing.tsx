'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { ExerciseShell } from '../../blocks/shell'
import { segmentsToText, textToSegments, type EditorProps } from '../block-defaults'
import { InlineText, InlineTextarea, SettingNumber, SettingToggle, Settings } from '../inline'

/** The blocks answered by typing, drawn as the player draws them. */

export function GapFillEditor({ draft, onChange, t }: EditorProps<'gap_fill'>) {
  // The raw text is kept here rather than re-derived from the segments on every render:
  // `[[colour|` is not a gap until it is closed, and rebuilding the string from a parse
  // that dropped the half-typed marker would pull the characters out from under the
  // cursor. The segments are what gets saved; this is only what is being typed.
  const [text, setText] = useState(() => segmentsToText(draft.segments))
  const segments = draft.segments ?? []

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingToggle
          label={t.library.editor.fields.caseSensitive}
          checked={draft.caseSensitive ?? false}
          onChange={(caseSensitive) => onChange({ caseSensitive })}
        />
      </Settings>

      <ExerciseShell
        label={t.library.blocks.fillGaps}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt: prompt || undefined })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
      >
        {/* The sentence as the student will see it: the gaps drawn as the player draws
            them, each showing the answer that fills it. */}
        {segments.length > 0 ? (
          <p className="text-[15px] leading-[2.4]">
            {segments.map((segment, index) =>
              segment.kind === 'text' ? (
                <span key={index} className="whitespace-pre-wrap">
                  {segment.text}
                </span>
              ) : (
                <span
                  key={segment.id}
                  className="border-input mx-1 inline-block min-w-[6ch] border-b-2 px-1 text-center"
                >
                  {segment.answers[0] ?? ' '}
                  {segment.answers.length > 1 ? (
                    <span className="text-muted-foreground text-xs">
                      {' '}
                      +{segment.answers.length - 1}
                    </span>
                  ) : null}
                </span>
              ),
            )}
          </p>
        ) : null}

        {/* And how it is written: one line of text with the holes marked. */}
        <div className="mt-3 border-t pt-3">
          <InlineTextarea
            value={text}
            onChange={(next) => {
              setText(next)
              onChange({ segments: textToSegments(next) })
            }}
            placeholder={t.library.editor.fields.gapText}
            rows={2}
            className="font-mono text-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs">{t.library.editor.fields.gapHint}</p>
        </div>
      </ExerciseShell>
    </div>
  )
}

export function FreeWritingEditor({ draft, onChange, t }: EditorProps<'free_writing'>) {
  return (
    <div className="grid gap-2">
      <Settings>
        <SettingNumber
          label={t.library.editor.fields.minWords}
          value={draft.minWords}
          min={1}
          onChange={(minWords) => onChange({ minWords })}
        />
        <SettingNumber
          label={t.library.editor.fields.maxWords}
          value={draft.maxWords}
          min={1}
          onChange={(maxWords) => onChange({ maxWords })}
        />
      </Settings>

      <ExerciseShell
        label={t.library.blocks.writing}
        prompt={
          <InlineTextarea
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
        hint={
          <InlineText
            value={draft.rubric ?? ''}
            onChange={(rubric) => onChange({ rubric: rubric || undefined })}
            placeholder={t.library.editor.fields.rubric}
            maxLength={1000}
          />
        }
      >
        {/* The box the student writes into, shown as they will find it. */}
        <Textarea
          disabled
          placeholder={t.library.blocks.writingPlaceholder}
          rows={4}
          className="resize-none"
        />

        <p className="text-muted-foreground mt-2 text-xs tabular-nums">
          0 {t.library.blocks.words}
          {draft.minWords !== undefined ? ` · ${t.library.blocks.minWords} ${draft.minWords}` : ''}
          {draft.maxWords !== undefined ? `–${draft.maxWords}` : ''}
        </p>
      </ExerciseShell>
    </div>
  )
}
