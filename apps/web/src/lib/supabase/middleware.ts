import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@tp/shared'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env'

/** Routes for people who are not signed in. Someone who is gets sent home from them. */
const GUEST_ROUTES = ['/login', '/signup', '/auth']

/** Routes open to everyone, signed in or not: a live lesson is entered by its link. */
const OPEN_ROUTES = ['/live']

const under = (routes: string[], pathname: string) =>
  routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser revalidates the token against Supabase. getSession only decodes the cookie,
  // which a client can forge, so it must never gate an access decision.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (under(OPEN_ROUTES, pathname)) return response

  if (!user && !under(GUEST_ROUTES, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && under(GUEST_ROUTES, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
