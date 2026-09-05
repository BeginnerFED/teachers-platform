import Link from 'next/link'
import { MessageSquareIcon, PhoneIcon } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { requireViewer } from '@/lib/auth'
import type { Messages } from '@/messages'
import { getMessages } from '@/messages/server'

type GroupKey = keyof Messages['help']['groups']

/** Which questions are worth whose time. */
const GROUPS_BY_ROLE: Record<'admin' | 'teacher' | 'student', GroupKey[]> = {
  admin: ['lessons', 'homework', 'people', 'account'],
  teacher: ['lessons', 'homework', 'people', 'account'],
  student: ['student', 'account'],
}

/** Rows after the eighth arrive together; a long list should land, not trickle. */
const STAGGER_CAP = 8
const STAGGER_MS = 35

/**
 * Help: a person to reach first, then the questions people actually ask, grouped and
 * chosen by who is asking. No search over a dozen questions — they fit on one screen, and
 * a box that finds nothing is worse than a list that is short.
 */
export default async function HelpPage() {
  const [viewer, t] = await Promise.all([requireViewer(), getMessages()])

  const chosen = GROUPS_BY_ROLE[viewer.role].map((key) => ({ key, ...t.help.groups[key] }))

  // Every row on the page shares one stagger, so the second group does not start from
  // zero again and arrive before the end of the first.
  const groups = chosen.map((group, index) => ({
    ...group,
    start: chosen.slice(0, index).reduce((count, earlier) => count + earlier.items.length, 0),
  }))

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.help.title}</h1>
        <p className="text-muted-foreground text-sm">{t.help.description}</p>
      </div>

      <section className="flex flex-col gap-2">
        <div className="border-border/60 bg-card flex flex-wrap items-center gap-4 rounded-2xl border p-5">
          <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
            <PhoneIcon className="size-4" />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{t.help.contact.label}</span>
            <a
              href={`tel:${t.help.contact.phone.replace(/\s+/g, '')}`}
              className="text-lg font-semibold tabular-nums tracking-tight hover:underline"
            >
              {t.help.contact.phone}
            </a>
            <span className="text-muted-foreground text-xs">{t.help.contact.hours}</span>
          </div>

          <Button asChild variant="outline">
            <Link href="/inbox">
              <MessageSquareIcon />
              {t.help.contact.write}
            </Link>
          </Button>
        </div>

        <p className="text-muted-foreground px-1 text-xs">{t.help.contact.note}</p>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="border-border/60 border-b pb-3 text-base font-semibold tracking-tight">
          {t.help.faq.title}
        </h2>

        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground px-1 text-xs font-medium uppercase tracking-wide">
              {group.title}
            </h3>

            <Accordion
              type="single"
              collapsible
              className="border-border/60 bg-card rounded-2xl border"
            >
              {group.items.map((item, index) => {
                const delay = Math.min(group.start + index, STAGGER_CAP) * STAGGER_MS

                return (
                  <AccordionItem
                    key={index}
                    value={`${group.key}-${index}`}
                    style={{ animationDelay: `${delay}ms` }}
                    className="animate-rise-in border-border/60 first:rounded-t-[inherit] last:rounded-b-[inherit] motion-reduce:animate-none"
                  >
                    <AccordionTrigger className="hover:bg-muted/40 rounded-[inherit] px-4 py-3.5 hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground px-4 pb-4 leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        ))}
      </section>
    </>
  )
}
