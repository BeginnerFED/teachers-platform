/**
 * The strings of the frame every page sits in: the error screens, and the names the
 * sidebar, the dialogs and the toasts give a screen reader.
 *
 * A file of their own so a client component can import them without the rest of the
 * dictionary. The error screens and the shadcn primitives that read these load on every
 * page, and uk.ts is over a hundred kilobytes that would otherwise ride along with them.
 * uk.ts includes this as `shell`, so a page holding `t` reads the very same strings.
 *
 * Read directly, they are Ukrainian whatever the development reading aid is set to.
 * Production is always Ukrainian anyway.
 */
export const shell = {
  /** The error screen's one sentence, and its button. */
  failed: 'Щось пішло не так. Спробуйте ще раз.',
  retry: 'Спробувати ще раз',
  toggleSidebar: 'Показати або сховати бічну панель',
  sidebarTitle: 'Меню',
  sidebarDescription: 'Розділи платформи, нещодавні сторінки та ваш обліковий запис.',
  close: 'Закрити',
  breadcrumb: 'Навігаційний ланцюжок',
  toasts: 'Сповіщення',
  notFound: {
    title: 'Сторінку не знайдено',
    body: 'Можливо, посилання застаріло або в ньому є помилка.',
    home: 'На головну',
  },
}
