import { GraduationCapIcon } from 'lucide-react'
import { LoginPromoSlot } from '@/features/login-promo/promo-slot'
import { PROMO_FILM } from '@/features/login-promo/promo-video'
import { returnPath } from '@/lib/return-path'
import { getMessages } from '@/messages/server'
import { LoginForm } from './login-form'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const [t, { next, error }] = await Promise.all([getMessages(), searchParams])

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <span className="flex items-center gap-2 font-medium">
            <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GraduationCapIcon className="size-4" />
            </span>
            {t.app.name}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {/* Where the proxy found them, so signing in finishes the trip they started
                instead of starting over from the home page. */}
            <LoginForm
              t={t}
              next={returnPath(next)}
              notice={error === 'profile' ? t.login.profileMissing : null}
            />
          </div>
        </div>
      </div>

      {/* login-02 puts a photograph here. This panel plays the product's promo film
          instead, rendered from the product's own screens. Its poster is the first paint
          and the frame without JavaScript — a background image, so phones, where the
          panel is hidden, never download it. */}
      <aside
        aria-label={t.loginPromo.label}
        className="relative hidden overflow-hidden bg-[#0b0908] bg-cover bg-center lg:block"
        style={{ backgroundImage: `url(${PROMO_FILM.poster})` }}
      >
        <div className="sr-only">
          <p>
            {t.app.tagline} {t.app.description}
          </p>
          <ul>
            {Object.values(t.promoFilm.headlines).map((headline) => (
              <li key={headline}>{headline.replaceAll('*', '')}</li>
            ))}
          </ul>
        </div>
        <LoginPromoSlot
          copy={{
            play: t.loginPromo.play,
            pause: t.loginPromo.pause,
            soundOn: t.loginPromo.soundOn,
            soundOff: t.loginPromo.soundOff,
          }}
        />
      </aside>
    </div>
  )
}
