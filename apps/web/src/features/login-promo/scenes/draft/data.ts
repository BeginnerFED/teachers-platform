/**
 * The lesson this scene drafts. Lesson content is English, so it is data rather than
 * dictionary copy; block types are the dialog's own keys, named from the dictionary.
 *
 * The draft has four steps (the form asks for 4); only the first, open as the dialog opens
 * it, is ever in frame.
 */

/** What the teacher types into "Тема уроку" — and what comes back as the draft's title. */
export const TOPIC = 'Ordering food at a restaurant'

export const DRAFT = {
  title: 'Ordering food at a restaurant',
  level: 'B1',
  tags: ['restaurant', 'speaking'],
  stepCount: 4,
} as const

export const FIRST_STEP = {
  title: 'At the table',
  blocks: ['multiple_choice', 'callout', 'text', 'multiple_choice', 'text'],
} as const

export const QUESTION = {
  prompt: 'Which is the polite way to ask?',
  options: [
    { text: 'I want the menu.', correct: false },
    { text: 'Could I have the menu?', correct: true },
    { text: 'Give me the menu.', correct: false },
  ],
} as const

export const NOTE = {
  title: 'Polite requests',
  text: 'Could I…? and I’d like… sound friendlier than I want….',
} as const
