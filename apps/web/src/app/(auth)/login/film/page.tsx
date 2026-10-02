import { notFound } from 'next/navigation'
import { pickFilmCopy } from '@/features/promo-film/copy'
import { FilmPlayer } from '@/features/promo-film/film-player'
import { getMessages } from '@/messages/server'

/**
 * Development only: the promo film's workbench. Plays it with its soundtrack, scrubs it,
 * and — with `?render` — draws bare frames for the renderer that turns it into the video
 * the sign-in page shows. Production never serves it.
 */
export default async function PromoFilmPage({ searchParams }: PageProps<'/login/film'>) {
  if (process.env.NODE_ENV !== 'development') notFound()

  const [t, { render }] = await Promise.all([getMessages(), searchParams])

  return <FilmPlayer copy={pickFilmCopy(t)} render={render !== undefined} />
}
