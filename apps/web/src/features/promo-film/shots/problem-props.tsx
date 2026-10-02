'use client'

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, RotateCwIcon, XIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

/**
 * The props of the problem shot: the old way of teaching, drawn as believable desktop
 * debris — PDF files and their "final" versions, a browser drowning in tabs, a call
 * stuck on screen sharing, a student asking for the file again, sticky notes. Pure
 * presentation: the shot places and moves them.
 */

/** A real document red, deliberately not the brand orange: this is the old world. */
export const PDF_RED = '#dc2626'

const INK_TEXT = '#1c1917'
const MUTED = '#78716c'
const HAIRLINE = '#e7e2dd'

/** One soft deep shadow and a hairline: enough to float, cheap enough for thirty props. */
const LIFT =
  '0 30px 54px -18px rgb(0 0 0 / 0.66), 0 10px 20px -12px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(0 0 0 / 0.05)'

function Paper({
  width,
  height,
  radius = 18,
  children,
  style,
}: {
  width: number
  height: number
  radius?: number
  children?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        background: 'linear-gradient(165deg, #ffffff 0%, #fbf8f6 60%, #f3efeb 100%)',
        color: INK_TEXT,
        boxShadow: LIFT,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** The page-with-a-dog-ear file glyph with its red PDF label. */
export function PdfGlyph({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 40 50"
      style={{ display: 'block', flex: 'none', overflow: 'visible' }}
    >
      <path
        d="M5 1.5h21.5L38.5 13.5V45a3.5 3.5 0 0 1-3.5 3.5H5A3.5 3.5 0 0 1 1.5 45V5A3.5 3.5 0 0 1 5 1.5Z"
        fill="#fff"
        stroke="#d6d0ca"
        strokeWidth="1.5"
      />
      <path
        d="M26.5 1.5V10a3.5 3.5 0 0 0 3.5 3.5h8.5"
        fill="#eee9e4"
        stroke="#d6d0ca"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="7" y="17" width="16" height="2.4" rx="1.2" fill="#e4dfda" />
      <rect x="-2" y="26" width="30" height="13.5" rx="3" fill={PDF_RED} />
      <text
        x="13"
        y="35.9"
        textAnchor="middle"
        fontSize="9.6"
        fontWeight="800"
        fill="#fff"
        letterSpacing="0.4"
      >
        PDF
      </text>
    </svg>
  )
}

/** A file as a chat attachment or a download: glyph, name, size. */
export function PdfChip({
  name,
  meta,
  width = 360,
}: {
  name: string
  meta: string
  width?: number
}) {
  return (
    <Paper
      width={width}
      height={86}
      radius={18}
      style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '0 22px 0 18px' }}
    >
      <PdfGlyph size={38} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 17.5,
            fontWeight: 620,
            letterSpacing: '-0.012em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div
          style={{ marginTop: 4, fontSize: 13.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}
        >
          {meta}
        </div>
      </div>
    </Paper>
  )
}

/** A file lying on a messy desktop: the glyph and its wrapped name, no card. */
export function DesktopFile({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ filter: 'drop-shadow(0 14px 16px rgb(0 0 0 / 0.55))' }}>
        <PdfGlyph size={64} />
      </div>
      <div
        style={{
          maxWidth: 150,
          padding: '2px 6px',
          borderRadius: 5,
          fontSize: 15,
          fontWeight: 560,
          lineHeight: 1.22,
          textAlign: 'center',
          color: '#fff',
          wordBreak: 'break-all',
          textShadow: '0 1px 4px rgb(0 0 0 / 0.9)',
        }}
      >
        {name}
      </div>
    </div>
  )
}

type Sheet = {
  level: string
  page: string
  title: string
  subtitle: string
  task: string
  lines: readonly string[]
  box?: string
}

/** Printed worksheets: English lesson content, not language the film has to translate. */
export const SHEETS: readonly Sheet[] = [
  {
    level: 'B1 · UNIT 12',
    page: '3 / 12',
    title: 'Present Perfect',
    subtitle: 'Worksheet · Grammar',
    task: 'A   Complete with the Present Perfect.',
    lines: [
      '1.  I ________ (never / be) to London.',
      '2.  She ________ (already / finish) it.',
      '3.  ________ you ________ (see) the film?',
      '4.  We ________ (just / have) lunch.',
      '5.  They ________ (not / call) yet.',
      '6.  He ________ (lose) his keys again.',
    ],
    box: 'ever · never · already · yet · just',
  },
  {
    level: 'A2 · UNIT 5',
    page: '1 / 4',
    title: 'Food & Drinks',
    subtitle: 'Vocabulary · Matching',
    task: 'B   Match the words to the pictures.',
    lines: [
      '1.  a loaf of ______         a)  juice',
      '2.  a carton of ______       b)  bread',
      '3.  a bar of ______          c)  soup',
      '4.  a bowl of ______         d)  chocolate',
      '5.  a can of ______          e)  cola',
    ],
    box: 'Bonus: write 3 sentences.',
  },
  {
    level: 'B2 · READING',
    page: '2 / 6',
    title: 'A Rainy Sunday',
    subtitle: 'Reading · 15 min',
    task: 'C   Read and answer the questions.',
    lines: [],
  },
] as const

export function Worksheet({ sheet }: { sheet: Sheet }) {
  return (
    <Paper width={300} height={414} radius={7} style={{ padding: '24px 24px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#a8a29e',
        }}
      >
        <span>{sheet.level}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sheet.page}</span>
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 25,
          fontWeight: 720,
          letterSpacing: '-0.025em',
          color: '#0c0a09',
        }}
      >
        {sheet.title}
      </div>
      <div style={{ marginTop: 3, fontSize: 12, color: MUTED }}>{sheet.subtitle}</div>
      <div style={{ marginTop: 12, height: 2, width: 44, borderRadius: 2, background: PDF_RED }} />
      <div style={{ marginTop: 14, fontSize: 11.5, fontWeight: 680, color: '#292524' }}>
        {sheet.task}
      </div>
      {sheet.lines.length > 0 ? (
        sheet.lines.map((line) => (
          <div
            key={line}
            style={{ marginTop: 10, fontSize: 11.2, color: '#44403c', whiteSpace: 'pre' }}
          >
            {line}
          </div>
        ))
      ) : (
        <div style={{ marginTop: 12 }}>
          {[100, 94, 98, 88, 96, 70, 0, 97, 92, 99, 60].map((width, index) =>
            width === 0 ? (
              <div key={index} style={{ height: 12 }} />
            ) : (
              <div
                key={index}
                style={{
                  marginTop: 8,
                  height: 5,
                  width: `${width}%`,
                  borderRadius: 3,
                  background: '#e7e2dd',
                }}
              />
            ),
          )}
        </div>
      )}
      {sheet.box ? (
        <div
          style={{
            marginTop: 16,
            padding: '8px 10px',
            border: `1.5px dashed ${HAIRLINE}`,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: '#57534e',
            textAlign: 'center',
          }}
        >
          {sheet.box}
        </div>
      ) : null}
    </Paper>
  )
}

const TAB_COLORS = [
  PDF_RED,
  '#4f7cf7',
  PDF_RED,
  PDF_RED,
  '#16a34a',
  PDF_RED,
  '#eab308',
  PDF_RED,
  '#57534e',
  PDF_RED,
  '#8b5cf6',
  PDF_RED,
  PDF_RED,
  '#0ea5e9',
  PDF_RED,
  '#4f7cf7',
  PDF_RED,
  PDF_RED,
  '#16a34a',
  PDF_RED,
] as const

function Lights({ size = 11, gap = 7 }: { size?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', gap, flex: 'none' }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
        <span
          key={color}
          style={{ width: size, height: size, borderRadius: 99, background: color }}
        />
      ))}
    </div>
  )
}

/** A browser with far too many tabs, a PDF open in the active one. */
export function TabBrowser({ title, url }: { title: string; url: string }) {
  const width = 660
  const height = 440
  return (
    <Paper width={width} height={height} radius={14} style={{ background: '#525659' }}>
      <div
        style={{
          position: 'relative',
          height: 44,
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 8px 0 84px',
          background: '#dfe1e5',
        }}
      >
        <div style={{ position: 'absolute', left: 16, top: 16 }}>
          <Lights />
        </div>
        {TAB_COLORS.map((color, index) =>
          index === 6 ? (
            <div
              key={index}
              style={{
                width: 156,
                height: 36,
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '0 9px',
                borderRadius: '10px 10px 0 0',
                background: '#fff',
                fontSize: 12,
                color: '#3c4043',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: PDF_RED,
                  flex: 'none',
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{title}</span>
              <XIcon style={{ width: 12, height: 12, flex: 'none' }} strokeWidth={2.4} />
            </div>
          ) : (
            <div
              key={index}
              style={{
                width: 21,
                height: 30,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                borderRight: index === 5 ? undefined : '1px solid #c3c6cb',
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
            </div>
          ),
        )}
        <PlusIcon
          style={{ width: 15, height: 15, margin: '0 0 8px 6px', color: '#5f6368', flex: 'none' }}
          strokeWidth={2.2}
        />
      </div>
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
          background: '#fff',
          color: '#5f6368',
        }}
      >
        <ChevronLeftIcon style={{ width: 17, height: 17 }} strokeWidth={2.2} />
        <ChevronRightIcon style={{ width: 17, height: 17, opacity: 0.45 }} strokeWidth={2.2} />
        <RotateCwIcon style={{ width: 14, height: 14 }} strokeWidth={2.4} />
        <div
          style={{
            flex: 1,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            borderRadius: 14,
            background: '#f1f3f4',
            fontSize: 13,
            color: '#3c4043',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {url}
        </div>
      </div>
      <div
        style={{
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: '#323639',
          color: '#f1f3f4',
          fontSize: 12.5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{ width: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {title}
        </span>
        <span>3 / 12</span>
        <span style={{ width: 200, textAlign: 'right' }}>– 100% +</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: (width - 270) / 2,
          top: 136,
          width: 270,
          height: 340,
          padding: '22px 22px 0',
          background: '#fff',
          boxShadow: '0 4px 14px rgb(0 0 0 / 0.35)',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 720, letterSpacing: '-0.02em' }}>
          Unit 12 · Lesson plan
        </div>
        {[96, 88, 100, 72, 0, 92, 98, 84, 0, 90, 76, 94].map((size, index) =>
          size === 0 ? (
            <div key={index} style={{ height: 10 }} />
          ) : (
            <div
              key={index}
              style={{
                marginTop: 9,
                height: 5,
                width: `${size}%`,
                borderRadius: 3,
                background: '#e5e1dd',
              }}
            />
          ),
        )}
      </div>
    </Paper>
  )
}

/** A student's message, late on a Sunday. */
export function ChatCard({
  name,
  initials,
  message,
  time,
  unread,
}: {
  name: string
  initials: string
  message: string
  time: string
  unread: number
}) {
  return (
    <div style={{ position: 'relative', width: 470, height: 184 }}>
      <Paper width={470} height={184} radius={26} style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              position: 'relative',
              width: 46,
              height: 46,
              borderRadius: 99,
              display: 'grid',
              placeItems: 'center',
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: 16,
              fontWeight: 700,
              flex: 'none',
            }}
          >
            {initials}
            <span
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 13,
                height: 13,
                borderRadius: 99,
                background: '#22c55e',
                border: '2.5px solid #fff',
              }}
            />
          </span>
          <span style={{ flex: 1, fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em' }}>
            {name}
          </span>
          <span style={{ fontSize: 14, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
            {time}
          </span>
        </div>
        <div
          style={{
            marginTop: 14,
            display: 'inline-block',
            padding: '13px 18px',
            borderRadius: '8px 22px 22px 22px',
            background: '#f1eeeb',
            fontSize: 21,
            lineHeight: 1.25,
            fontWeight: 480,
            letterSpacing: '-0.01em',
          }}
        >
          {message}
        </div>
      </Paper>
      <span
        style={{
          position: 'absolute',
          right: -12,
          top: -12,
          minWidth: 38,
          height: 38,
          padding: '0 10px',
          borderRadius: 99,
          display: 'grid',
          placeItems: 'center',
          background: '#ef4444',
          color: '#fff',
          fontSize: 18,
          fontWeight: 700,
          boxShadow: '0 8px 18px rgb(0 0 0 / 0.4), 0 0 0 3px #fff',
        }}
      >
        {unread}
      </span>
    </div>
  )
}

/** A sticky note: what did not fit anywhere else. */
export function Sticky({ text, tone = 0 }: { text: string; tone?: 0 | 1 }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 178,
        height: 178,
        padding: '34px 18px 0 20px',
        borderRadius: 3,
        background:
          tone === 0
            ? 'linear-gradient(180deg, #fde68a, #fcd34d)'
            : 'linear-gradient(180deg, #fef3c7, #fde68a)',
        color: '#3f3420',
        fontSize: 25,
        fontWeight: 640,
        lineHeight: 1.16,
        letterSpacing: '-0.015em',
        whiteSpace: 'pre-line',
        boxShadow: '0 24px 34px -16px rgb(0 0 0 / 0.6), 0 2px 3px rgb(0 0 0 / 0.12)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 54,
          top: -10,
          width: 70,
          height: 22,
          background: 'rgb(255 255 255 / 0.5)',
          transform: 'rotate(-4deg)',
          boxShadow: '0 1px 2px rgb(0 0 0 / 0.08)',
        }}
      />
      {text}
    </div>
  )
}

/** The big badge of the counter: the PDF label, blown up. */
export function PdfBadge({ height = 64 }: { height?: number }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        height,
        padding: `0 ${height * 0.26}px`,
        borderRadius: height * 0.24,
        background: `linear-gradient(180deg, #ef4444, ${PDF_RED})`,
        color: '#fff',
        fontSize: height * 0.5,
        fontWeight: 800,
        letterSpacing: '0.02em',
        boxShadow: `0 10px 26px -8px rgb(220 38 38 / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.3)`,
      }}
    >
      PDF
    </span>
  )
}
