'use client'

import {
  BanIcon,
  CalendarPlusIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type {
  SubscriptionEvent,
  SubscriptionEventType,
  TeacherDetail,
  TeacherListItem,
} from '@tp/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountActions } from '@/features/accounts/components/account-actions'
import { linkStudent, loadStudentOptions, unlinkStudent } from '@/features/roster/actions'
import { EndLinkButton } from '@/features/roster/components/end-link-button'
import { PickPersonDialog } from '@/features/roster/components/pick-person-dialog'
import { formatDate, formatRelative, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { initialTeacherActionState, type TeacherActionState } from '../action-state'
import {
  extendSubscription,
  loadTeacherDetail,
  reactivateSubscription,
  suspendSubscription,
} from '../actions'
import { dayNoun } from '../format'
import { SubscriptionBadge } from './subscription-badge'

type Action = (prev: TeacherActionState, formData: FormData) => Promise<TeacherActionState>

const EVENT_ICON: Record<SubscriptionEventType, LucideIcon> = {
  trial_started: SparklesIcon,
  extended: CalendarPlusIcon,
  suspended: PauseIcon,
  reactivated: PlayIcon,
  canceled: BanIcon,
}

/**
 * The label never shrinks and the value never wraps: a Ukrainian label is half again as
 * long as its Turkish equivalent, and letting either of them reflow pushed every row in
 * the panel out of alignment with the next.
 */
function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="grid justify-items-end text-right">
        <span className="whitespace-nowrap tabular-nums">{value}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </span>
    </div>
  )
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-muted/40 divide-border divide-y rounded-lg border', className)}>
      {children}
    </div>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3
      className={cn(
        'text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-widest',
        className,
      )}
    >
      {children}
    </h3>
  )
}

function Timeline({
  events,
  t,
  locale,
}: {
  events: SubscriptionEvent[]
  t: Messages
  locale: string
}) {
  return (
    <ol className="relative">
      {events.map((event, index) => {
        const Icon = EVENT_ICON[event.type]
        const months = typeof event.payload.months === 'number' ? event.payload.months : null
        const reason = typeof event.payload.reason === 'string' ? event.payload.reason : null
        const last = index === events.length - 1

        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* The line is drawn behind the dots and stops at the last one, so the
                sequence reads as finished rather than trailing off. */}
            {!last ? (
              <span className="bg-border absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px" />
            ) : null}

            <span className="bg-background text-muted-foreground ring-border relative flex size-8 shrink-0 items-center justify-center rounded-full ring-1">
              <Icon className="size-3.5" />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {t.teachers.events[event.type]}
                  {months ? (
                    <span className="text-muted-foreground font-normal">
                      {' · '}
                      {months} {t.teachers.detail.months}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground shrink-0 whitespace-nowrap text-xs">
                  {formatRelative(event.createdAt, locale)}
                </span>
              </div>

              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {event.actor
                  ? (event.actor.fullName ?? event.actor.email)
                  : t.teachers.detail.system}
              </p>

              {reason ? (
                <p className="text-muted-foreground bg-muted/60 mt-1.5 rounded-md px-2 py-1 text-xs">
                  {reason}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function TeacherDetailSheet({
  teacher,
  t,
  locale,
}: {
  teacher: TeacherListItem
  t: Messages
  locale: string
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<TeacherDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const [confirmingSuspend, setConfirmingSuspend] = useState(false)
  const router = useRouter()

  const name = teacher.fullName ?? teacher.email

  /** After the roster changes: the panel re-reads itself, and the row behind it re-renders. */
  async function change(run: () => Promise<{ error: string | null }>) {
    const result = await run()

    if (!result.error) {
      load()
      router.refresh()
    }

    return result
  }

  function load() {
    setFailed(false)

    startTransition(async () => {
      const result = await loadTeacherDetail(teacher.id)

      if ('error' in result) setFailed(true)
      else setDetail(result.data)
    })
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Refetched on each open rather than cached, so an action taken here is reflected
    // the next time the panel is looked at.
    if (next) load()
  }

  function submit(action: Action, extra: Record<string, string> = {}) {
    const formData = new FormData()
    formData.set('teacherId', teacher.id)
    for (const [key, value] of Object.entries(extra)) formData.set(key, value)

    startTransition(async () => {
      const result = await action(initialTeacherActionState, formData)

      if (result.error) toast.error(t.errors[result.error])
      else if (result.done) {
        toast.success(t.teachers.toast[result.done])
        load()
      }
    })
  }

  const subscription = detail?.subscription
  const status = subscription?.status ?? teacher.subscription?.status
  const days = subscription?.daysRemaining ?? null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.teachers.detail.open}
            // The explicit hover: repeats the row's colours, because the ghost variant
            // brings its own hover and would otherwise win when the cursor is on the
            // button itself — making it revert exactly as you reach for it.
            className="corner-brackets bg-muted text-muted-foreground group-hover/row:bg-primary group-hover/row:text-primary-foreground hover:bg-primary hover:text-primary-foreground size-8 transition-colors duration-150"
          >
            <ChevronRightIcon />
          </Button>
        </SheetTrigger>

        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-11 rounded-xl">
                <AvatarFallback className="rounded-xl text-sm font-medium">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <SheetTitle className="truncate text-left text-base">{name}</SheetTitle>
                <SheetDescription className="truncate text-left text-xs">
                  {teacher.email}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5">
            {failed ? (
              <p className="text-destructive text-sm">{t.teachers.detail.loadFailed}</p>
            ) : !detail ? (
              <div className="flex flex-col gap-5">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* The one number an admin came here for, at a size they can read across
                    a desk, with the status that qualifies it directly underneath. */}
                <div className="bg-muted/40 flex items-end justify-between gap-4 rounded-xl border p-4">
                  <div className="grid gap-1">
                    <span
                      className={`text-4xl font-semibold tabular-nums leading-none ${
                        subscription && !subscription.hasAccess ? 'text-destructive' : ''
                      }`}
                    >
                      {days === null ? '—' : days > 0 ? days : 0}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {days === null
                        ? t.teachers.noEndDate
                        : days <= 0
                          ? t.teachers.expired
                          : `${dayNoun(days, t)} ${t.teachers.detail.remainingSuffix}`}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <SubscriptionBadge subscription={subscription ?? null} t={t} />
                    <span
                      className={`text-xs ${subscription?.hasAccess ? 'text-muted-foreground' : 'text-destructive'}`}
                    >
                      {t.teachers.detail.access}:{' '}
                      {subscription?.hasAccess
                        ? t.teachers.detail.accessYes
                        : t.teachers.detail.accessNo}
                    </span>
                  </div>
                </div>

                <div>
                  <SectionTitle>{t.teachers.detail.subscription}</SectionTitle>

                  {subscription ? (
                    <Panel>
                      <Row
                        label={t.teachers.detail.accessEnds}
                        value={formatDate(subscription.accessEndsAt, locale)}
                        hint={
                          subscription.accessEndsAt
                            ? formatRelative(subscription.accessEndsAt, locale)
                            : undefined
                        }
                      />
                      <Row
                        label={t.teachers.detail.trialEnds}
                        value={formatDate(subscription.trialEndsAt, locale)}
                      />
                      <Row
                        label={t.teachers.detail.periodEnds}
                        value={formatDate(subscription.currentPeriodEnd, locale)}
                      />
                      <Row
                        label={t.teachers.detail.startedAt}
                        value={formatDate(subscription.startedAt, locale)}
                      />
                    </Panel>
                  ) : (
                    <Panel>
                      <div className="text-muted-foreground px-3 py-3 text-sm">
                        {t.teachers.noSubscription}
                      </div>
                    </Panel>
                  )}
                </div>

                <div>
                  <SectionTitle>{t.teachers.detail.account}</SectionTitle>
                  <Panel>
                    <Row
                      label={t.teachers.detail.joined}
                      value={formatDate(detail.createdAt, locale)}
                      hint={formatRelative(detail.createdAt, locale)}
                    />
                  </Panel>

                  {/* Under the facts about the account, the two things you can do to it. */}
                  <div className="mt-2">
                    <AccountActions
                      account={{ id: teacher.id, email: detail.email, fullName: detail.fullName }}
                      onChanged={() => {
                        load()
                        router.refresh()
                      }}
                      t={t}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <SectionTitle className="mb-0">
                      {t.teachers.detail.students}
                      {detail.students.total > 0 ? (
                        <span className="text-muted-foreground ml-1.5 normal-case tabular-nums">
                          ({detail.students.total})
                        </span>
                      ) : null}
                    </SectionTitle>

                    <PickPersonDialog
                      label={t.teachers.detail.addStudent}
                      title={t.teachers.detail.pickStudent.title}
                      description={t.teachers.detail.pickStudent.description}
                      searchPlaceholder={t.teachers.detail.pickStudent.search}
                      emptyMessage={t.teachers.detail.pickStudent.empty}
                      exclude={detail.students.items.map((student) => student.id)}
                      load={loadStudentOptions}
                      onPick={(studentId) => change(() => linkStudent(teacher.id, studentId))}
                      success={t.teachers.detail.linked}
                      failure={t.errors.internal}
                    />
                  </div>

                  {detail.students.items.length === 0 ? (
                    <Panel>
                      <div className="text-muted-foreground px-3 py-3 text-sm">
                        {t.teachers.detail.noStudents}
                      </div>
                    </Panel>
                  ) : (
                    // Its own scroll area past about seven rows, so a long roll does not
                    // push the history section off the bottom of the panel.
                    <Panel className="max-h-72 overflow-y-auto">
                      {detail.students.items.map((student) => {
                        const studentName = student.fullName ?? student.email

                        return (
                          <div
                            key={student.id}
                            className="group/person flex items-center gap-3 px-3 py-2"
                          >
                            <Avatar className="size-7 rounded-md">
                              <AvatarFallback className="rounded-md text-[10px] font-medium">
                                {initials(studentName)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="grid min-w-0 flex-1">
                              <span className="truncate text-sm">{studentName}</span>
                              <span className="text-muted-foreground truncate text-xs">
                                {student.email}
                              </span>
                            </div>

                            <span className="text-muted-foreground shrink-0 whitespace-nowrap text-xs">
                              {formatRelative(student.since, locale)}
                            </span>

                            <EndLinkButton
                              label={t.teachers.detail.endLink}
                              confirm={t.teachers.detail.endConfirm}
                              onEnd={() => change(() => unlinkStudent(teacher.id, student.id))}
                              success={t.teachers.detail.unlinked}
                              failure={t.errors.internal}
                            />
                          </div>
                        )
                      })}

                      {/* Only reachable past a hundred students, where listing every one
                          stops being useful and starts being a payload. */}
                      {detail.students.total > detail.students.items.length ? (
                        <div className="text-muted-foreground px-3 py-2 text-xs">
                          {t.teachers.detail.andMore}{' '}
                          {detail.students.total - detail.students.items.length}
                        </div>
                      ) : null}
                    </Panel>
                  )}
                </div>

                <div>
                  <SectionTitle>{t.teachers.detail.history}</SectionTitle>

                  {detail.events.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t.teachers.detail.noHistory}</p>
                  ) : (
                    <Timeline events={detail.events} t={t} locale={locale} />
                  )}
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t p-4">
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() => submit(extendSubscription, { months: '1' })}
            >
              {pending ? t.teachers.actions.working : t.teachers.actions.extend}
            </Button>

            {status === 'suspended' ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => submit(reactivateSubscription)}
              >
                {t.teachers.actions.reactivate}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={pending || status === 'canceled'}
                onClick={() => setConfirmingSuspend(true)}
              >
                {t.teachers.actions.suspend}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Suspending takes someone's ability to work away mid-lesson, so it asks first. */}
      <AlertDialog open={confirmingSuspend} onOpenChange={setConfirmingSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.teachers.suspendConfirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.teachers.suspendConfirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.teachers.suspendConfirm.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(suspendSubscription)}>
              {t.teachers.suspendConfirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
