'use client'

import { useTransition } from 'react'
import { Loader2Icon, MessageSquareIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { openConversation } from '@/features/inbox/actions'
import type { Messages } from '@/messages'

/**
 * Straight to the conversation with this teacher, started if there is none yet. A refusal,
 * such as a link that ended a moment ago, is said in a toast, as the inbox's own picker
 * says it, rather than taking the whole section down to its error screen.
 *
 * Given its words rather than the dictionary: everything else on the page is drawn on the
 * server, and the dictionary would travel to the browser for this one button.
 */
export function MessageTeacherButton({
  teacherId,
  label,
  errors,
}: {
  teacherId: string
  label: string
  errors: Messages['errors']
}) {
  const [pending, startTransition] = useTransition()

  const open = () => {
    const formData = new FormData()
    formData.set('recipientId', teacherId)
    startTransition(async () => {
      // Comes back only when it did not go to the conversation.
      const result = await openConversation(formData)
      if (result.error) toast.error(errors[result.error])
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="corner-brackets"
      disabled={pending}
      onClick={open}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <MessageSquareIcon />}
      {label}
    </Button>
  )
}
