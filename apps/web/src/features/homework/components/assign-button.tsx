'use client'

import { useState } from 'react'
import { SendIcon } from 'lucide-react'
import type { MaterialOwner } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorStepCount } from '@/features/library/editor/editor-flush'
import type { Messages } from '@/messages'
import { AssignDialog } from './assign-dialog'

/** The lesson page's one filled action: "give this lesson to…". */
export function AssignButton({
  materialId,
  stepCount,
  recipients,
  t,
}: {
  materialId: string
  /** As the page was rendered. The open editor's own count replaces it. */
  stepCount: number
  recipients: MaterialOwner[]
  t: Messages
}) {
  const [open, setOpen] = useState(false)
  const editing = useEditorStepCount()

  // An empty lesson given as homework is a page with nothing to do and nothing to hand
  // in, and the student is left holding that copy even after steps are added.
  if ((editing ?? stepCount) === 0) {
    return (
      <Tooltip>
        {/* A disabled button takes no pointer, so the hint hangs on what holds it. */}
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="focus-visible:ring-ring/50 focus-visible:ring-3 rounded-full outline-none"
          >
            <Button type="button" disabled className="corner-brackets">
              <SendIcon />
              {t.homework.assign}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t.library.editor.empty.assignHint}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <Button type="button" className="corner-brackets" onClick={() => setOpen(true)}>
        <SendIcon />
        {t.homework.assign}
      </Button>

      <AssignDialog
        open={open}
        onOpenChange={setOpen}
        materialId={materialId}
        recipients={recipients}
        t={t}
      />
    </>
  )
}
