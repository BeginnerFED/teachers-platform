'use client'

import { BellIcon, CheckIcon, CircleCheckIcon, SparklesIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { FilmCopy } from '../copy'
import { BRAND } from '../time'

/**
 * The climax's cast: every product piece the film has shown, built small enough to orbit.
 *
 * Each one is drawn from the screen its chapter filmed — the lesson card, the AI dialog,
 * the gap-fill block, the live board, the homework sent to three students, the checked
 * result, the assistant's review, the week and the reminder — in the product's own light
 * surface, words and colours, at a size that still reads while it flies.
 */

/** The app's light tokens, resolved. */
const TEXT = '#171717'
const MUTED = '#737373'
const LINE = '#e5e5e5'
const WASH = '#f4f4f5'
const MONO = 'var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace'
const EMERALD = '#10b981'
const EMERALD_DEEP = '#047857'

/** Lesson content stays English, as on the platform: data, not dictionary copy. */
const TOPIC = 'Ordering food at a restaurant'
const TAGS = ['restaurant', 'speaking']
const FIRST_STEP = 'At the table'

type Who = 'olya' | 'maksym' | 'iryna' | 'dmytro' | 'anna'

/** Each student's tint, as the calendar and the live room colour them. */
const TINT: Record<Who, CSSProperties> = {
  olya: {
    background: '#e0f2fe',
    color: '#075985',
    boxShadow: 'inset 0 0 0 1.5px rgb(7 89 133 / 0.3)',
  },
  maksym: {
    background: '#ede9fe',
    color: '#5b21b6',
    boxShadow: 'inset 0 0 0 1.5px rgb(91 33 182 / 0.3)',
  },
  iryna: {
    background: '#d1fae5',
    color: '#065f46',
    boxShadow: 'inset 0 0 0 1.5px rgb(6 95 70 / 0.3)',
  },
  dmytro: {
    background: '#fef3c7',
    color: '#92400e',
    boxShadow: 'inset 0 0 0 1.5px rgb(146 64 14 / 0.3)',
  },
  anna: {
    background: '#ffe4e6',
    color: '#9f1239',
    boxShadow: 'inset 0 0 0 1.5px rgb(159 18 57 / 0.3)',
  },
}

const ONE_LINE: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const CENTER: CSSProperties = { display: 'grid', placeItems: 'center' }

export type Piece = {
  id: string
  width: number
  radius: number
  render: (copy: FilmCopy, t: number) => ReactNode
}

export type Token = {
  id: string
  /** The beat it pops on, if it has one. */
  hit?: 'check' | 'bell'
  render: (copy: FilmCopy, t: number) => ReactNode
}

/** LevelChip: a CEFR level as the small quiet pill the library shows. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        background: WASH,
        color: '#3f3f46',
        borderRadius: 99,
        padding: '2px 9px',
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: '18px',
      }}
    >
      {children}
    </span>
  )
}

/** The editor's gap: the word stays, underlined in the brand colour. */
function Gap({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: 56,
        margin: '0 3px',
        padding: '0 5px',
        textAlign: 'center',
        lineHeight: 1.4,
        borderBottom: `2.5px solid ${BRAND}`,
        background: 'rgb(255 79 1 / 0.09)',
        borderRadius: '4px 4px 1px 1px',
      }}
    >
      {children}
    </span>
  )
}

function LessonCard({
  lesson,
}: {
  lesson: { title: string; level: string; meta: string } | undefined
}) {
  if (!lesson) return null
  return (
    <div style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 19, fontWeight: 560, lineHeight: 1.28, letterSpacing: '-0.012em' }}>
        {lesson.title}
      </div>
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          fontSize: 13.5,
          color: MUTED,
        }}
      >
        <Chip>{lesson.level}</Chip>
        <span style={{ fontVariantNumeric: 'tabular-nums', ...ONE_LINE }}>{lesson.meta}</span>
      </div>
    </div>
  )
}

/** The AI lesson dialog, its topic typed, the draft one press away. */
function DialogCard({ copy, t }: { copy: FilmCopy; t: number }) {
  const draft = copy.promo.scenes.draft
  const caret = Math.floor(t / 530) % 2 === 0
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            ...CENTER,
            width: 34,
            height: 34,
            borderRadius: 99,
            background: 'rgb(255 79 1 / 0.1)',
            color: BRAND,
            flexShrink: 0,
          }}
        >
          <SparklesIcon style={{ width: 17, height: 17 }} />
        </span>
        <span style={{ fontSize: 16.5, fontWeight: 600, ...ONE_LINE }}>{draft.dialogTitle}</span>
      </div>
      <div
        style={{
          marginTop: 14,
          height: 38,
          borderRadius: 10,
          border: `1.5px solid ${BRAND}`,
          boxShadow: '0 0 0 3px rgb(255 79 1 / 0.16)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 11px',
          fontSize: 14.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {TOPIC}
        <span
          style={{
            width: 1.5,
            height: 18,
            marginLeft: 1,
            background: TEXT,
            opacity: caret ? 1 : 0,
          }}
        />
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 36,
            padding: '0 14px',
            borderRadius: 10,
            background: BRAND,
            color: 'white',
            fontSize: 14.5,
            fontWeight: 560,
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 18px -8px rgb(255 79 1 / 0.8)',
          }}
        >
          <SparklesIcon style={{ width: 15, height: 15 }} />
          {draft.generate}
        </span>
      </div>
    </div>
  )
}

/** The draft the dialog brings back: title, level and tags, the first step. */
function DraftCard({ copy }: { copy: FilmCopy }) {
  const badge: CSSProperties = {
    borderRadius: 99,
    padding: '2px 9px',
    fontSize: 12,
    fontWeight: 560,
    lineHeight: '16px',
  }
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 16.5, fontWeight: 600, ...ONE_LINE }}>{TOPIC}</div>
      <div style={{ marginTop: 9, display: 'flex', gap: 6 }}>
        <span style={{ ...badge, boxShadow: `inset 0 0 0 1px ${LINE}` }}>B1</span>
        {TAGS.map((tag) => (
          <span key={tag} style={{ ...badge, background: WASH, color: '#3f3f46' }}>
            {tag}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          border: `1px solid ${LINE}`,
          borderRadius: 11,
          padding: '9px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            ...CENTER,
            width: 24,
            height: 24,
            borderRadius: 99,
            background: WASH,
            color: MUTED,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          1
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 560 }}>{FIRST_STEP}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: MUTED, ...ONE_LINE }}>
            {copy.promo.scenes.draft.stepSummary}
          </span>
        </span>
      </div>
    </div>
  )
}

/** The gap-fill block, two words already turned into gaps. */
function EditorCard({ copy }: { copy: FilmCopy }) {
  return (
    <div style={{ padding: '15px 18px 12px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        {copy.promo.scenes.editor.fillGaps}
      </div>
      <div style={{ marginTop: 4, fontSize: 15.5, lineHeight: 2.15, whiteSpace: 'nowrap' }}>
        Could I <Gap>have</Gap> the bill, please?
        <br />
        Would you like to pay by <Gap>card</Gap>?
      </div>
    </div>
  )
}

/** The live board: who is in the room, and Максим in his gap, answered and marked. */
function LiveCard({ copy, t }: { copy: FilmCopy; t: number }) {
  const live = copy.promo.scenes.live
  const ping = (t % 1000) / 1000
  const discs: [string, string][] = [
    ['#14b8a6', live.hostInitials],
    ['#a855f7', live.maksymInitials],
    ['#0ea5e9', live.olyaInitials],
  ]
  return (
    <div style={{ padding: 14 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12.5,
            color: MUTED,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: '#ef4444',
              flexShrink: 0,
              boxShadow: `0 0 0 ${ping * 7}px rgb(239 68 68 / ${0.4 * (1 - ping)})`,
            }}
          />
          <span style={ONE_LINE}>{live.roomAfter}</span>
        </span>
        <span style={{ display: 'flex', flexShrink: 0 }}>
          {discs.map(([color, initials], index) => (
            <span
              key={color}
              style={{
                ...CENTER,
                width: 22,
                height: 22,
                borderRadius: 99,
                background: color,
                color: 'white',
                fontSize: 8.5,
                fontWeight: 650,
                marginLeft: index ? -6 : 0,
                boxShadow: '0 0 0 2px white',
              }}
            >
              {initials}
            </span>
          ))}
        </span>
      </div>
      <div
        style={{
          marginTop: 12,
          border: `1px solid ${LINE}`,
          borderRadius: 12,
          padding: '10px 12px 4px',
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: MUTED,
          }}
        >
          {live.fillGaps}
        </div>
        <div style={{ fontSize: 15.5, lineHeight: 2.5, whiteSpace: 'nowrap' }}>
          Could I{' '}
          <span style={{ position: 'relative', display: 'inline-block', margin: '0 4px' }}>
            <span
              style={{
                display: 'inline-block',
                minWidth: 60,
                textAlign: 'center',
                borderBottom: `2px solid ${EMERALD}`,
                color: EMERALD_DEEP,
                lineHeight: 1.4,
                padding: '0 4px',
              }}
            >
              have
            </span>
            <span
              style={{
                position: 'absolute',
                inset: -3,
                borderRadius: 6,
                border: '2px solid #a855f7',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: -4,
                top: -21,
                background: '#a855f7',
                color: 'white',
                fontSize: 10.5,
                fontWeight: 600,
                lineHeight: 1,
                padding: '3px 7px',
                borderRadius: 99,
                whiteSpace: 'nowrap',
              }}
            >
              {live.maksym}
            </span>
          </span>{' '}
          the bill?
        </div>
      </div>
    </div>
  )
}

/** One lesson, three students, three copies: sent. */
function HomeworkCard({ copy }: { copy: FilmCopy }) {
  const faces = copy.promo.scenes.schedule.faces
  const people: Who[] = ['olya', 'maksym', 'iryna']
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {people.map((who) => (
          <span
            key={who}
            style={{
              ...CENTER,
              ...TINT[who],
              position: 'relative',
              width: 46,
              height: 46,
              borderRadius: 99,
              fontSize: 15,
              fontWeight: 650,
            }}
          >
            {faces[who]}
            <span
              style={{
                ...CENTER,
                position: 'absolute',
                right: -3,
                bottom: -3,
                width: 19,
                height: 19,
                borderRadius: 99,
                background: EMERALD,
                boxShadow: '0 0 0 2.5px white',
              }}
            >
              <CheckIcon color="white" strokeWidth={3.4} style={{ width: 11, height: 11 }} />
            </span>
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 14.5,
          fontWeight: 560,
        }}
      >
        <CircleCheckIcon
          strokeWidth={2.2}
          style={{ width: 17, height: 17, color: EMERALD, flexShrink: 0 }}
        />
        <span style={ONE_LINE}>{copy.promo.scenes.homework.sent}</span>
      </div>
    </div>
  )
}

/** Every answer right: the full ring, the score, the player's own verdict. */
function CheckCard({ copy }: { copy: FilmCopy }) {
  return (
    <div style={{ padding: '14px 18px 14px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width={58} height={58} viewBox="0 0 58 58" style={{ flexShrink: 0 }}>
        <circle
          cx={29}
          cy={29}
          r={24}
          fill="rgb(16 185 129 / 0.08)"
          stroke={EMERALD}
          strokeWidth={5.5}
        />
        <path
          d="M19 30l7 7 13-15"
          fill="none"
          stroke={EMERALD}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 27,
            fontWeight: 680,
            color: EMERALD_DEEP,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          100%
        </span>
        <span style={{ display: 'block', marginTop: 3, fontSize: 13.5, color: MUTED, ...ONE_LINE }}>
          {copy.promo.scenes.live.allCorrect}
        </span>
      </span>
    </div>
  )
}

/** The review card: the exercises marked, the assistant drafting the feedback. */
function AssistantCard({ copy }: { copy: FilmCopy }) {
  const feedback = copy.promo.scenes.feedback
  const bar: CSSProperties = { display: 'block', height: 6, borderRadius: 3, background: '#e7e5e4' }
  return (
    <div style={{ padding: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 11px',
          borderRadius: 11,
          background: 'rgb(16 185 129 / 0.08)',
          fontSize: 13.5,
          fontWeight: 560,
        }}
      >
        <CircleCheckIcon
          strokeWidth={2.2}
          style={{ width: 16, height: 16, color: EMERALD, flexShrink: 0 }}
        />
        <span style={ONE_LINE}>{feedback.exercises}</span>
      </div>
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          gap: 10,
          padding: 11,
          borderRadius: 11,
          background: 'rgb(255 79 1 / 0.05)',
          boxShadow: 'inset 0 0 0 1px rgb(255 79 1 / 0.14)',
        }}
      >
        <span
          style={{
            ...CENTER,
            width: 30,
            height: 30,
            borderRadius: 99,
            background: 'rgb(255 79 1 / 0.1)',
            color: BRAND,
            flexShrink: 0,
          }}
        >
          <SparklesIcon style={{ width: 15, height: 15 }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, ...ONE_LINE }}>
            {feedback.assistantTitle}
          </span>
          <span style={{ ...bar, marginTop: 7, width: '92%' }} />
          <span style={{ ...bar, marginTop: 5, width: '66%' }} />
        </span>
      </div>
    </div>
  )
}

/** Where the week's lessons sit: [weekday index, row] in the cropped afternoon. */
const WEEK: { day: number; row: number; who: Who }[] = [
  { day: 0, row: 1, who: 'olya' },
  { day: 1, row: 0, who: 'iryna' },
  { day: 1, row: 2, who: 'dmytro' },
  { day: 2, row: 1, who: 'olya' },
  { day: 3, row: 1, who: 'olya' },
  { day: 3, row: 2, who: 'maksym' },
  { day: 5, row: 0.5, who: 'anna' },
]

/** The week grid: today in the brand circle, each lesson its student's face. */
function CalendarCard({ copy }: { copy: FilmCopy }) {
  const schedule = copy.promo.scenes.schedule
  return (
    <div style={{ padding: '12px 12px 10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
        {schedule.days.map((day) => (
          <div
            key={day.day}
            style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.25, textTransform: 'capitalize' }}
          >
            {day.weekday}
            <div
              style={
                day.today
                  ? {
                      ...CENTER,
                      margin: '3px auto 0',
                      width: 24,
                      height: 24,
                      borderRadius: 99,
                      background: BRAND,
                      color: 'white',
                      fontSize: 12.5,
                      fontWeight: 700,
                    }
                  : {
                      ...CENTER,
                      marginTop: 3,
                      height: 24,
                      fontSize: 13,
                      fontWeight: 560,
                      color: TEXT,
                    }
              }
            >
              {day.day}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{ position: 'relative', marginTop: 8, height: 100, borderTop: `1px solid ${LINE}` }}
      >
        {[34, 67].map((y) => (
          <div
            key={y}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: y,
              borderTop: `1px dashed ${LINE}`,
            }}
          />
        ))}
        {WEEK.map((lesson) => (
          <span
            key={`${lesson.day}-${lesson.row}`}
            style={{
              ...CENTER,
              ...TINT[lesson.who],
              position: 'absolute',
              left: `calc(${((lesson.day + 0.5) / 7) * 100}% - 13px)`,
              top: 7 + lesson.row * 31,
              width: 26,
              height: 26,
              borderRadius: 99,
              fontSize: 9.5,
              fontWeight: 650,
            }}
          >
            {schedule.faces[lesson.who]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The platform's own reminder, fifteen minutes before the lesson. */
function ReminderCard({ copy, t }: { copy: FilmCopy; t: number }) {
  const swing = Math.sin(t / 90) * 12 * (0.55 + 0.45 * Math.sin(t / 700))
  return (
    <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          ...CENTER,
          width: 42,
          height: 42,
          borderRadius: 99,
          background: BRAND,
          flexShrink: 0,
          boxShadow: '0 6px 16px -6px rgb(255 79 1 / 0.75)',
        }}
      >
        <BellIcon
          color="white"
          strokeWidth={2.2}
          style={{
            width: 20,
            height: 20,
            transform: `rotate(${swing}deg)`,
            transformOrigin: '50% 12%',
          }}
        />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, ...ONE_LINE }}>
          {copy.promo.scenes.schedule.reminder}
        </span>
        <span
          style={{ display: 'block', marginTop: 2, fontSize: 13, color: '#525252', ...ONE_LINE }}
        >
          {TOPIC}
        </span>
      </span>
    </div>
  )
}

/**
 * The orbit's cards, in their order round the ring (the first starts at the front; the
 * ring turns them right to left along the front).
 */
export const PIECES: Piece[] = [
  { id: 'live', width: 300, radius: 20, render: (copy, t) => <LiveCard copy={copy} t={t} /> },
  {
    id: 'lesson',
    width: 270,
    radius: 20,
    render: (copy) => <LessonCard lesson={copy.promo.scenes.library.picked[0]} />,
  },
  { id: 'homework', width: 270, radius: 20, render: (copy) => <HomeworkCard copy={copy} /> },
  { id: 'calendar', width: 300, radius: 18, render: (copy) => <CalendarCard copy={copy} /> },
  {
    id: 'reminder',
    width: 330,
    radius: 18,
    render: (copy, t) => <ReminderCard copy={copy} t={t} />,
  },
  { id: 'check', width: 250, radius: 20, render: (copy) => <CheckCard copy={copy} /> },
  { id: 'assistant', width: 300, radius: 20, render: (copy) => <AssistantCard copy={copy} /> },
  { id: 'draft', width: 300, radius: 20, render: (copy) => <DraftCard copy={copy} /> },
  { id: 'editor', width: 318, radius: 20, render: (copy) => <EditorCard copy={copy} /> },
  { id: 'dialog', width: 290, radius: 20, render: (copy, t) => <DialogCard copy={copy} t={t} /> },
]

function LevelToken({ level }: { level: string }) {
  return (
    <span
      style={{
        ...CENTER,
        height: 38,
        padding: '0 15px',
        borderRadius: 99,
        background: 'white',
        color: '#27272a',
        fontFamily: MONO,
        fontSize: 18,
        fontWeight: 650,
        boxShadow: '0 14px 26px -12px rgb(0 0 0 / 0.75), inset 0 0 0 1px #e4e4e7',
      }}
    >
      {level}
    </span>
  )
}

function FaceToken({ copy, who }: { copy: FilmCopy; who: Who }) {
  return (
    <span
      style={{
        ...CENTER,
        ...TINT[who],
        width: 52,
        height: 52,
        borderRadius: 99,
        fontSize: 17,
        fontWeight: 650,
        boxShadow: `${TINT[who].boxShadow}, 0 0 0 3px white, 0 14px 26px -12px rgb(0 0 0 / 0.8)`,
      }}
    >
      {copy.promo.scenes.schedule.faces[who]}
    </span>
  )
}

function IconToken({ background, children }: { background: string; children: ReactNode }) {
  return (
    <span
      style={{
        ...CENTER,
        width: 54,
        height: 54,
        borderRadius: 99,
        background,
        boxShadow: '0 0 0 3px rgb(255 255 255 / 0.9), 0 14px 26px -12px rgb(0 0 0 / 0.8)',
      }}
    >
      {children}
    </span>
  )
}

/**
 * The small things on the outer orbit: the levels, the class, and the marks the chapters
 * ended on — checked, reminded, drafted. The check and the bell pass the front on the beats
 * 1000 and 1500, and pop there.
 */
export const TOKENS: Token[] = [
  {
    id: 'check',
    hit: 'check',
    render: () => (
      <IconToken background={EMERALD}>
        <CheckIcon color="white" strokeWidth={3.2} style={{ width: 26, height: 26 }} />
      </IconToken>
    ),
  },
  {
    id: 'bell',
    hit: 'bell',
    render: () => (
      <IconToken background={BRAND}>
        <BellIcon color="white" strokeWidth={2.4} style={{ width: 25, height: 25 }} />
      </IconToken>
    ),
  },
  {
    id: 'sparkle',
    render: () => (
      <IconToken background="white">
        <SparklesIcon color={BRAND} strokeWidth={2.2} style={{ width: 26, height: 26 }} />
      </IconToken>
    ),
  },
  { id: 'a1', render: () => <LevelToken level="A1" /> },
  { id: 'olya', render: (copy) => <FaceToken copy={copy} who="olya" /> },
  { id: 'a2', render: () => <LevelToken level="A2" /> },
  { id: 'maksym', render: (copy) => <FaceToken copy={copy} who="maksym" /> },
  { id: 'b1', render: () => <LevelToken level="B1" /> },
  { id: 'iryna', render: (copy) => <FaceToken copy={copy} who="iryna" /> },
  { id: 'b2', render: () => <LevelToken level="B2" /> },
  { id: 'c1', render: () => <LevelToken level="C1" /> },
  { id: 'c2', render: () => <LevelToken level="C2" /> },
]
