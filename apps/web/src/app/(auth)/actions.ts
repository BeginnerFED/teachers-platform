'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { DEFAULT_LOCALE } from '@tp/shared'
import { createClient } from '@/lib/supabase/server'
import { getMessages } from '@/messages/server'
import type { AuthState } from './auth-state'

const credentials = z.object({
  email: z.email(),
  password: z.string().min(8),
})

const registration = credentials.extend({
  fullName: z.string().trim().min(1).max(120),
})

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getMessages()

  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: t.auth.invalidInput, notice: null }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  // Supabase can tell "no such account" apart from "wrong password". We deliberately do
  // not, so the form cannot be used to discover which addresses are registered.
  if (error) return { error: t.auth.invalidCredentials, notice: null }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getMessages()

  const parsed = registration.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  })
  if (!parsed.success) return { error: t.auth.invalidInput, notice: null }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Cosmetic fields only. The role is set by the database trigger, which ignores
      // this object exactly because the client controls what goes in it.
      data: { full_name: parsed.data.fullName, locale: DEFAULT_LOCALE },
    },
  })
  if (error) return { error: t.auth.genericError, notice: null }

  // With email confirmation enabled there is no session yet — the account exists but
  // cannot be used until the link is clicked.
  if (!data.session) return { error: null, notice: t.signup.checkEmail }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/login')
}
