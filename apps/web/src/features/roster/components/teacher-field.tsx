'use client'

import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Person } from '../actions'
import { NO_TEACHER } from '../constants'

/**
 * Who a new student will study with, asked on the same form as their name. Optional: the
 * common case has a teacher already waiting for them, the other case is an account made
 * ahead of time, and neither should cost a second dialog.
 */
export function TeacherField({
  teachers,
  label,
  none,
}: {
  teachers: Person[]
  label: string
  /** The wording of the "nobody yet" choice. */
  none: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor="newStudentTeacher">{label}</FieldLabel>
      {/* `name` makes Radix render a hidden native select, so the choice travels with the
          form like the two text fields do. */}
      <Select name="teacherId" defaultValue={NO_TEACHER}>
        <SelectTrigger id="newStudentTeacher" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TEACHER}>
            <span className="text-muted-foreground">{none}</span>
          </SelectItem>
          {teachers.map((teacher) => (
            <SelectItem key={teacher.id} value={teacher.id}>
              {teacher.fullName ?? teacher.email}
              {teacher.fullName ? (
                <span className="text-muted-foreground ml-1.5 text-xs">{teacher.email}</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
