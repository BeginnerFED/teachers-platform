'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/**
 * A text box whose value belongs to the room.
 *
 * While somebody is typing in one, what they typed is what they see. Without that, a
 * value arriving from another browser mid-word — a classmate in the same gap, a re-read
 * of the board landing a beat behind the keyboard — replaces the text under the caret,
 * which jumps to the end, and the next letter is grafted onto somebody else's sentence.
 * Leaving the box adopts the room's value again, so the two never differ for longer than
 * a visit — and so does a box that stops being editable, which is a leaving of its own:
 * a step marked while somebody is mid-word takes the keyboard away, and a box nobody can
 * put a caret in has no blur left to wait for.
 */
function useTyped(
  value: string,
  onValue: (next: string) => void,
  { transform, disabled }: { transform?: (raw: string) => string; disabled?: boolean } = {},
) {
  const [typed, setTyped] = useState<string | null>(null)

  return {
    // Shown at once rather than after the effect, so a marked answer never lingers under
    // a mark that was given to a different word.
    value: disabled ? value : (typed ?? value),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = transform ? transform(event.target.value) : event.target.value
      setTyped(next)
      onValue(next)
    },
    onBlur: () => setTyped(null),
    // Coming back to a box also adopts the room's value, which is what a box that was
    // taken away mid-word and given back needs: it was never blurred, so nothing else
    // would have let go of the half-word left in it.
    onFocus: () => setTyped(null),
  }
}

type Shared<T> = Omit<T, 'value' | 'onChange'> & {
  value: string
  onValue: (next: string) => void
  /** What the box makes of what was typed — upper case for a crossword, say. */
  transform?: (raw: string) => string
}

/** A bare input, for the ones drawn inline in a sentence. */
export function SharedField({
  value,
  onValue,
  transform,
  ...props
}: Shared<React.ComponentProps<'input'>>) {
  return <input {...props} {...useTyped(value, onValue, { transform, disabled: props.disabled })} />
}

export function SharedInput({
  value,
  onValue,
  transform,
  ...props
}: Shared<React.ComponentProps<typeof Input>>) {
  return <Input {...props} {...useTyped(value, onValue, { transform, disabled: props.disabled })} />
}

export function SharedTextarea({
  value,
  onValue,
  transform,
  ...props
}: Shared<React.ComponentProps<typeof Textarea>>) {
  return (
    <Textarea {...props} {...useTyped(value, onValue, { transform, disabled: props.disabled })} />
  )
}
