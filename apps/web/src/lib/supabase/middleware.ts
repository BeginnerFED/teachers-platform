import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@tp/shared'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env'
import { returnPath } from '@/lib/return-path'

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

  const { pathname, searchParams } = request.nextUrl

  if (under(OPEN_ROUTES, pathname)) return response

  // A live room's pictures and recordings, asked for by everybody in it — guests in by the
  // link included, who have no session to show. The route handler is the one that decides:
  // the room id opens that room's media for as long as it is live, and nothing else.
  if (under(['/media'], pathname) && searchParams.has('live')) return response

  if (!user && !under(GUEST_ROUTES, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    // The query string travels too: a link to a filtered list should come back filtered.
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  // Signed in, but sent here by a page that found no profile behind the account. Sending
  // them home from it would only send them straight back, round and round.
  if (user && pathname === '/login' && searchParams.get('error') === 'profile') return response

  if (user && under(GUEST_ROUTES, pathname)) {
    const url = request.nextUrl.clone()
    const next = new URL(returnPath(searchParams.get('next')) ?? '/', url)
    url.pathname = next.pathname
    url.search = next.search
    return NextResponse.redirect(url)
  }

  return response
}
