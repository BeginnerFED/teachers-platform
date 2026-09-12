'use client'

import { useState, useTransition } from 'react'
import { Loader2Icon, PlayIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { StudentMaterial } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { Messages } from '@/messages'
import { loadPlayable } from '../actions'
import { flushPendingSaves } from '../editor/editor-flush'
import { MaterialPlayer } from './material-player'

/**
 * The preview, opened on top of the editor rather than as a page of its own. Nothing is
 * navigated away from, so nothing is restored from a cache later and nothing queued for
 * saving is left behind: the button waits for the last edit to land, then asks the server
 * for the lesson exactly as a student would receive it, and plays that.
 */
export function PreviewButton({
  materialId,
  label,
  t,
}: {
  materialId: string
  label: string
  t: Messages
}) {
  const [open, setOpen] = useState(false)
  const [material, setMaterial] = useState<StudentMaterial | null>(null)
  const [pending, startTransition] = useTransition()

  const openPreview = () =>
    startTransition(async () => {
      try {
        await flushPendingSaves()
      } catch {
        toast.error(t.editorRecovery.blocked)
        return
      }
      const { material: playable, error } = await loadPlayable(materialId)

      if (error || !playable) {
        toast.error(t.library.toast.failed)
        return
      }

      setMaterial(playable)
      setOpen(true)
    })

  return (
    <>
      <Button type="button" variant="outline" disabled={pending} onClick={openPreview}>
        {pending ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none">
          <DialogTitle className="sr-only">{t.library.editor.preview.title}</DialogTitle>

          <div className="flex h-12 shrink-0 items-center border-b px-4">
            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              {t.library.editor.preview.title}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {material ? (
              // Re-keyed per opening so every preview starts from the first step, unmarked.
              <MaterialPlayer
                key={`${material.id}-${String(open)}`}
                material={material}
                onExit={() => setOpen(false)}
                t={t}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
