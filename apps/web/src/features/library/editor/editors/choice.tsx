'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { OptionRow } from '../../blocks/choice'
import { ExerciseShell } from '../../blocks/shell'
import { newId, type EditorProps } from '../block-defaults'
import { AddRow, RemoveRow } from '../fields'
import { InlineText, SettingNumber, SettingToggle, Settings } from '../inline'

/**
 * The blocks whose answer is one of a set the author writes down. Each is the player's
 * own frame with the author's words typed into it: an option is edited on the row the
 * student will tap, and ticking it there is what marks it right.
 */

export function MultipleChoiceEditor({ draft, onChange, t }: EditorProps<'multiple_choice'>) {
  const options = draft.options ?? []
  const correct = draft.correctIds ?? []
  const multiple = draft.multiple ?? false

  const setOption = (id: string, text: string) =>
    onChange({ options: options.map((o) => (o.id === id ? { ...o, text } : o)) })

  const toggleCorrect = (id: string) => {
    if (multiple) {
      onChange({
        correctIds: correct.includes(id) ? correct.filter((c) => c !== id) : [...correct, id],
      })
    } else {
      // One right answer: ticking a second one moves the tick rather than adding it.
      onChange({ correctIds: correct.includes(id) ? [] : [id] })
    }
  }

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingToggle
          label={t.library.editor.fields.multiple}
          checked={multiple}
          onChange={(next) =>
            // Going back to single-answer keeps at most one tick.
            onChange({ multiple: next, correctIds: next ? correct : correct.slice(0, 1) })
          }
        />
        <SettingToggle
          label={t.library.editor.fields.shuffle}
          checked={draft.shuffle ?? true}
          onChange={(shuffle) => onChange({ shuffle })}
        />
      </Settings>

      <ExerciseShell
        label={multiple ? t.library.blocks.selectMany : t.library.blocks.selectOne}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
      >
        <div className="space-y-2">
          {options.map((option, index) => {
            const isCorrect = correct.includes(option.id)

            return (
              <OptionRow
                key={option.id}
                checked={isCorrect}
                tone={undefined}
                onSelect={() => toggleCorrect(option.id)}
                control={
                  <Checkbox
                    checked={isCorrect}
                    onCheckedChange={() => toggleCorrect(option.id)}
                    aria-label={t.library.editor.fields.correct}
                    className="mt-0.5"
                  />
                }
              >
                <span className="flex items-center gap-1">
                  <InlineText
                    value={option.text}
                    onChange={(text) => setOption(option.id, text)}
                    placeholder={`${t.library.editor.fields.option} ${index + 1}`}
                    maxLength={300}
                    className="leading-snug"
                  />
                  <RemoveRow
                    label={t.library.editor.fields.remove}
                    disabled={options.length <= 2}
                    onClick={() =>
                      onChange({
                        options: options.filter((o) => o.id !== option.id),
                        correctIds: correct.filter((c) => c !== option.id),
                      })
                    }
                  />
                </span>
              </OptionRow>
            )
          })}

          {options.length < 8 ? (
            <AddRow onClick={() => onChange({ options: [...options, { id: newId(), text: '' }] })}>
              {t.library.editor.fields.addOption}
            </AddRow>
          ) : null}
        </div>

        {/* Drawn where the player will draw it, under a rule, once the answer is in. */}
        <div className="mt-4 border-t pt-3">
          <InlineText
            value={draft.explanation ?? ''}
            onChange={(explanation) => onChange({ explanation: explanation || undefined })}
            placeholder={t.library.editor.fields.explanation}
            maxLength={1000}
            className="text-muted-foreground text-sm"
          />
        </div>
      </ExerciseShell>
    </div>
  )
}

export function TrueFalseEditor({ draft, onChange, t }: EditorProps<'true_false'>) {
  const statements = draft.statements ?? []

  const set = (id: string, patch: Partial<(typeof statements)[number]>) =>
    onChange({ statements: statements.map((s) => (s.id === id ? { ...s, ...patch } : s)) })

  return (
    <ExerciseShell
      label={t.library.blocks.trueFalse}
      prompt={
        <InlineText
          value={draft.prompt ?? ''}
          onChange={(prompt) => onChange({ prompt: prompt || undefined })}
          placeholder={t.library.editor.fields.prompt}
          maxLength={1000}
        />
      }
    >
      <ul className="space-y-2">
        {statements.map((statement) => (
          <li
            key={statement.id}
            className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
          >
            <span className="flex min-w-0 flex-1 items-center gap-1">
              <InlineText
                value={statement.text}
                onChange={(text) => set(statement.id, { text })}
                placeholder={t.library.editor.fields.statements}
                maxLength={400}
                className="leading-snug"
              />
            </span>

            {/* The same two choices the student gets; here they set which one is right. */}
            <RadioGroup
              value={statement.isTrue ? 'true' : 'false'}
              onValueChange={(next) => set(statement.id, { isTrue: next === 'true' })}
              className="flex shrink-0 gap-4"
            >
              {(['true', 'false'] as const).map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <RadioGroupItem value={option} />
                  {option === 'true' ? t.library.blocks.isTrue : t.library.blocks.isFalse}
                </label>
              ))}
            </RadioGroup>

            <RemoveRow
              label={t.library.editor.fields.remove}
              disabled={statements.length <= 1}
              onClick={() =>
                onChange({ statements: statements.filter((s) => s.id !== statement.id) })
              }
            />
          </li>
        ))}
      </ul>

      {statements.length < 10 ? (
        <AddRow
          className="mt-2"
          onClick={() =>
            onChange({ statements: [...statements, { id: newId(), text: '', isTrue: true }] })
          }
        >
          {t.library.editor.fields.addStatement}
        </AddRow>
      ) : null}
    </ExerciseShell>
  )
}

export function QuizGameEditor({ draft, onChange, t }: EditorProps<'quiz_game'>) {
  const questions = draft.questions ?? []

  const setQuestion = (id: string, patch: Partial<(typeof questions)[number]>) =>
    onChange({ questions: questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) })

  return (
    <div className="grid gap-2">
      <Settings>
        <SettingNumber
          label={t.library.editor.fields.secondsPerQuestion}
          value={draft.secondsPerQuestion ?? 20}
          min={5}
          max={120}
          onChange={(seconds) => onChange({ secondsPerQuestion: seconds ?? 20 })}
        />
      </Settings>

      <ExerciseShell
        label={t.library.blocks.quiz}
        prompt={
          <InlineText
            value={draft.prompt ?? ''}
            onChange={(prompt) => onChange({ prompt: prompt || undefined })}
            placeholder={t.library.editor.fields.prompt}
            maxLength={1000}
          />
        }
      >
        {/* The questions as the player lists them afterwards, one card each. */}
        <ul className="space-y-2">
          {questions.map((question, index) => (
            <li key={question.id} className="border-border rounded-md border p-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5 w-5 shrink-0 text-xs tabular-nums">
                  {index + 1}
                </span>
                <InlineText
                  value={question.prompt}
                  onChange={(prompt) => setQuestion(question.id, { prompt })}
                  placeholder={t.library.editor.fields.question}
                  maxLength={300}
                  className="font-medium"
                />
                <RemoveRow
                  label={t.library.editor.fields.remove}
                  disabled={questions.length <= 1}
                  onClick={() =>
                    onChange({ questions: questions.filter((q) => q.id !== question.id) })
                  }
                />
              </div>

              <div className="mt-2 grid gap-2 pl-7 sm:grid-cols-2">
                {question.options.map((option) => (
                  <OptionRow
                    key={option.id}
                    checked={question.correctId === option.id}
                    tone={undefined}
                    onSelect={() =>
                      setQuestion(question.id, {
                        correctId: question.correctId === option.id ? '' : option.id,
                      })
                    }
                    control={
                      <Checkbox
                        checked={question.correctId === option.id}
                        onCheckedChange={() =>
                          setQuestion(question.id, {
                            correctId: question.correctId === option.id ? '' : option.id,
                          })
                        }
                        aria-label={t.library.editor.fields.correct}
                        className="mt-0.5"
                      />
                    }
                  >
                    <span className="flex items-center gap-1">
                      <InlineText
                        value={option.text}
                        onChange={(text) =>
                          setQuestion(question.id, {
                            options: question.options.map((o) =>
                              o.id === option.id ? { ...o, text } : o,
                            ),
                          })
                        }
                        placeholder={t.library.editor.fields.option}
                        maxLength={300}
                        className="leading-snug"
                      />
                      <RemoveRow
                        label={t.library.editor.fields.remove}
                        disabled={question.options.length <= 2}
                        onClick={() =>
                          setQuestion(question.id, {
                            options: question.options.filter((o) => o.id !== option.id),
                            correctId: question.correctId === option.id ? '' : question.correctId,
                          })
                        }
                      />
                    </span>
                  </OptionRow>
                ))}

                {question.options.length < 4 ? (
                  <AddRow
                    onClick={() =>
                      setQuestion(question.id, {
                        options: [...question.options, { id: newId(), text: '' }],
                      })
                    }
                  >
                    {t.library.editor.fields.addOption}
                  </AddRow>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {questions.length < 20 ? (
          <AddRow
            className="mt-2"
            onClick={() =>
              onChange({
                questions: [
                  ...questions,
                  {
                    id: newId(),
                    prompt: '',
                    options: [
                      { id: newId(), text: '' },
                      { id: newId(), text: '' },
                    ],
                    correctId: '',
                  },
                ],
              })
            }
          >
            {t.library.editor.fields.addQuestion}
          </AddRow>
        ) : null}
      </ExerciseShell>
    </div>
  )
}
