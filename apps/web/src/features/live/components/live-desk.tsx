'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BellRingIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
  RadioIcon,
  SearchIcon,
  UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { MaterialListItem, MaterialOwner } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { launchLive } from '../actions'
import { ActiveLessonCard } from './active-lesson-card'
import { useLiveLauncher } from './live-launcher'
import { LiveMaterialDialog, type MaterialOptions } from './live-material-dialog'
import { PrepareTrackedLiveDialog } from './prepare-tracked-live-dialog'

export function LiveDesk({
  students,
  materials,
  selectedStudent,
  locale,
  t,
}: {
  students: MaterialOwner[] | null
  materials: MaterialOptions | null
  selectedStudent?: string
  locale: string
  t: Messages
}) {
  const { session, failed, pending: ending } = useLiveLauncher()
  const router = useRouter()
  const [mode, setMode] = useState<'students' | 'link'>('students')
  const [selected, setSelected] = useState<string[]>(() =>
    students?.some((student) => student.id === selectedStudent) ? [selectedStudent!] : [],
  )
  const [search, setSearch] = useState('')
  const [material, setMaterial] = useState<MaterialListItem | null>(null)
  const [picker, setPicker] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [preparing, setPreparing] = useState(!!selectedStudent)
  const [confirmation, setConfirmation] = useState<{ id: string; title: string } | null>(null)
  const [pending, transition] = useTransition()
  const locked = useRef(false)
  const chosen = students?.filter((student) => selected.includes(student.id)) ?? []
  const term = search.trim().toLocaleLowerCase(locale)
  const visible =
    students?.filter((student) =>
      `${student.fullName ?? ''} ${student.email}`.toLocaleLowerCase(locale).includes(term),
    ) ?? []
  const ready =
    !!material?.stepCount &&
    !failed &&
    !ending &&
    !pending &&
    (mode === 'link' || chosen.length > 0)

  function launch(expectedId: string | null) {
    if (!ready || !material || locked.current) return
    locked.current = true
    transition(async () => {
      try {
        const result = await launchLive(
          material.id,
          expectedId,
          mode === 'students' ? chosen.map((student) => student.id) : [],
        )
        if (result.error || !result.data) {
          toast.error(
            result.error === 'lesson_time_conflict'
              ? t.liveDesk.tracking.timeConflict
              : result.error === 'conflict'
                ? t.teacherLive.activeChanged
                : t.errors[result.error ?? 'internal'],
          )
          router.refresh()
        } else {
          if (mode === 'students')
            toast.success(t.liveDesk.invited.replace('{count}', String(chosen.length)))
          router.push(`/live/${result.data.id}`)
        }
      } catch {
        toast.error(t.live.failed)
      } finally {
        locked.current = false
        setConfirmation(null)
      }
    })
  }
  return (
    <>
      {(session || failed) && <ActiveLessonCard locale={locale} />}
      {session && !preparing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-4">
          <p className="text-muted-foreground text-sm">{t.liveDesk.nextLessonHint}</p>
          <Button variant="outline" className="corner-brackets" onClick={() => setPreparing(true)}>
            <PlusIcon />
            {t.liveDesk.prepareNext}
          </Button>
        </div>
      ) : (
        <div
          id="prepare"
          className="grid scroll-mt-20 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as 'students' | 'link')}
            className="gap-0"
            asChild
          >
            <section className="bg-card min-w-0 overflow-hidden rounded-xl border">
              <div className="border-b p-5">
                <div className="flex items-center gap-3">
                  <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                    1
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">{t.liveDesk.studentsTitle}</h2>
                    <p className="text-muted-foreground mt-1 text-xs">{t.liveDesk.studentsHint}</p>
                  </div>
                </div>
                <TabsList aria-label={t.liveDesk.participation} className="mt-5 max-w-full">
                  <TabsTrigger
                    value="students"
                    disabled={pending}
                    className="min-w-0 flex-initial px-2 sm:px-3"
                  >
                    <UsersIcon className="size-3.5" />
                    <span className="truncate">{t.liveDesk.registered}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="link"
                    disabled={pending}
                    className="min-w-0 flex-initial px-2 sm:px-3"
                  >
                    <LinkIcon className="size-3.5" />
                    <span className="truncate">{t.liveDesk.guest}</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="link" className="animate-rise-in motion-reduce:animate-none">
                <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="bg-muted mb-4 flex size-12 items-center justify-center rounded-2xl">
                    <LinkIcon className="text-muted-foreground size-5" />
                  </span>
                  <h3 className="text-sm font-medium">{t.liveDesk.guestTitle}</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
                    {t.liveDesk.guestHint}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="students" className="animate-rise-in motion-reduce:animate-none">
                <div className="relative m-4">
                  <SearchIcon className="text-muted-foreground absolute left-3 top-2.5 size-4" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.liveDesk.searchStudent}
                    aria-label={t.liveDesk.searchStudent}
                    className="pl-9"
                  />
                </div>
                {students === null ? (
                  <div
                    role="alert"
                    className="flex min-h-48 flex-col items-center justify-center gap-3 p-5 text-center"
                  >
                    <p className="text-muted-foreground text-sm">{t.liveDesk.studentsFailed}</p>
                    <RefreshDashboard label={t.common.retry} />
                  </div>
                ) : !students.length ? (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                    <UsersIcon className="text-muted-foreground/50 mb-2 size-7" />
                    <h3 className="text-sm font-medium">{t.liveDesk.noStudents}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t.liveDesk.noStudentsHint}
                    </p>
                  </div>
                ) : !visible.length ? (
                  <p className="text-muted-foreground py-12 text-center text-sm">
                    {t.liveDesk.noMatches}
                  </p>
                ) : (
                  <ul className="max-h-96 overflow-y-auto px-2 pb-2">
                    {visible.map((student) => {
                      const checked = selected.includes(student.id)
                      const name = student.fullName || student.email
                      return (
                        <li key={student.id}>
                          <button
                            type="button"
                            aria-pressed={checked}
                            disabled={pending || (!checked && selected.length >= 50)}
                            onClick={() =>
                              setSelected((current) =>
                                checked
                                  ? current.filter((id) => id !== student.id)
                                  : [...current, student.id],
                              )
                            }
                            className={cn(
                              'focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
                              checked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-xl border text-xs font-medium',
                                checked
                                  ? 'text-primary border-primary/20 bg-primary/5'
                                  : 'bg-muted/30 text-muted-foreground',
                              )}
                            >
                              {initials(name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{name}</span>
                              <span className="text-muted-foreground mt-1 block truncate text-xs">
                                {student.email}
                              </span>
                            </span>
                            <span
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded border',
                                checked
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-input',
                              )}
                            >
                              {checked && <CheckIcon className="size-3" />}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="text-muted-foreground flex items-center justify-between gap-3 border-t px-5 py-3 text-xs">
                  <span>{t.liveDesk.selected.replace('{count}', String(chosen.length))}</span>
                  {chosen.length > 0 && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setSelected([])}
                      className="corner-brackets hover:text-foreground rounded-sm transition-colors disabled:pointer-events-none"
                    >
                      {t.library.clear}
                    </button>
                  )}
                </div>
              </TabsContent>
            </section>
          </Tabs>
          <aside className="bg-card min-w-0 overflow-hidden rounded-xl border lg:sticky lg:top-6">
            <div className="flex items-center gap-3 border-b p-5">
              <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                2
              </span>
              <div>
                <h2 className="text-sm font-semibold">{t.liveDesk.prepareTitle}</h2>
                <p className="text-muted-foreground mt-1 text-xs">{t.liveDesk.prepareHint}</p>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <p className="text-muted-foreground mb-2 text-[11px] font-medium">
                  {t.liveDesk.participants}
                </p>
                {mode === 'link' ? (
                  <p className="flex items-center gap-2 text-sm">
                    <LinkIcon className="size-4" />
                    {t.liveDesk.guest}
                  </p>
                ) : chosen.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {chosen.map((student) => (
                      <span
                        key={student.id}
                        className="bg-muted max-w-full truncate rounded-full px-2.5 py-1 text-xs"
                      >
                        {student.fullName || student.email}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{t.liveDesk.chooseStudent}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-[11px] font-medium">
                  {t.liveDesk.materialLabel}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPicker(true)}
                  className="corner-brackets hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <FileTextIcon className="text-muted-foreground size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {material?.title || t.teacherLive.choose}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {material
                        ? `${material.level} · ${material.stepCount} ${t.library.card.steps}`
                        : t.liveDesk.materialFromLibrary}
                    </span>
                  </span>
                  {material ? (
                    <ChevronRightIcon className="text-muted-foreground size-4" />
                  ) : (
                    <PlusIcon className="text-muted-foreground size-4" />
                  )}
                </button>
              </div>
              <div className="bg-muted/40 flex items-start gap-2.5 rounded-xl p-3">
                <BellRingIcon className="text-primary mt-0.5 size-4 shrink-0" />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {mode === 'students' ? t.liveDesk.notificationHint : t.liveDesk.linkHint}
                </p>
              </div>
              <Button
                className="corner-brackets h-auto min-h-9 w-full whitespace-normal py-2"
                disabled={!ready}
                onClick={() =>
                  mode === 'students'
                    ? setTracking(true)
                    : session
                      ? setConfirmation({ id: session.id, title: session.material.title })
                      : launch(null)
                }
              >
                {pending ? <Loader2Icon className="animate-spin" /> : <RadioIcon />}
                {pending
                  ? t.live.starting
                  : mode === 'students'
                    ? t.liveDesk.tracking.review
                    : t.live.start}
              </Button>
              {session && (
                <Button
                  className="corner-brackets w-full"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setPreparing(false)}
                >
                  {t.live.confirmEnd.cancel}
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}
      {picker && (
        <LiveMaterialDialog
          initial={materials}
          selectedId={material?.id}
          onSelect={setMaterial}
          onClose={() => setPicker(false)}
          t={t}
        />
      )}
      {tracking && material && (
        <PrepareTrackedLiveDialog
          students={chosen}
          material={material}
          locale={locale}
          t={t}
          onClose={() => setTracking(false)}
        />
      )}
      <Dialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !locked.current) setConfirmation(null)
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{t.teacherLive.replaceTitle}</DialogTitle>
            <DialogDescription>
              {t.liveDesk.replaceBody.replace('{current}', confirmation?.title ?? '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="corner-brackets"
              disabled={pending}
              onClick={() => setConfirmation(null)}
            >
              {t.live.confirmEnd.cancel}
            </Button>
            <Button
              className="corner-brackets"
              disabled={pending || !ready}
              onClick={() => {
                if (confirmation) launch(confirmation.id)
              }}
            >
              {pending && <Loader2Icon className="animate-spin" />}
              {t.teacherLive.replaceConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
