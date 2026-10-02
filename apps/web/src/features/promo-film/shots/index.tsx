'use client'

import type { ReactNode } from 'react'
import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import type { ShotId } from '../film'
import * as check from './check'
import * as climax from './climax'
import * as draft from './draft'
import * as editor from './editor'
import * as end from './end'
import * as homework from './homework'
import * as library from './library'
import * as live from './live'
import * as open from './open'
import * as problem from './problem'
import * as schedule from './schedule'
import * as turn from './turn'

export type ShotModule = { Shot: (props: { copy: FilmCopy }) => ReactNode; cues: readonly Cue[] }

/** Every shot of the film, by id. Each module owns its picture and the sounds it asks for. */
export const SHOTS: Record<ShotId, ShotModule> = {
  open,
  problem,
  turn,
  library,
  draft,
  editor,
  live,
  homework,
  check,
  schedule,
  climax,
  end,
}
