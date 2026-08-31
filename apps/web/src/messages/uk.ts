/**
 * Ukrainian is the language the product ships in. Every string lives here rather than
 * inline, so moving to a real i18n library later is a mechanical change, not a rewrite.
 */
export const uk = {
  app: {
    name: 'Teachers Platform',
    description: 'Платформа для викладачів англійської мови.',
    tagline: 'Більше часу на викладання, менше — на підготовку.',
  },
  common: {
    signOut: 'Вийти',
    loading: 'Завантаження...',
    soon: 'Незабаром',
    retry: 'Спробувати ще раз',
  },
  nav: {
    workspace: 'Робоча область',
    search: 'Пошук',
    home: 'Головна',
    settings: 'Налаштування',
    help: 'Довідка',
    empty: 'Поки порожньо',
    overview: 'Огляд',
    library: 'Бібліотека',
    teachers: 'Викладачі',
    students: 'Учні',
    myStudents: 'Мої учні',
    assignments: 'Завдання',
    progress: 'Прогрес',
  },
  roles: {
    admin: 'Адміністратор',
    teacher: 'Викладач',
    student: 'Учень',
  },
  account: {
    upgrade: 'Перейти на Pro',
    account: 'Обліковий запис',
    billing: 'Оплата',
    notifications: 'Сповіщення',
  },
  auth: {
    emailLabel: 'Електронна пошта',
    passwordLabel: 'Пароль',
    fullNameLabel: "Ім'я та прізвище",
    invalidInput: 'Перевірте введені дані. Пароль має містити щонайменше 8 символів.',
    invalidCredentials: 'Невірна пошта або пароль.',
    genericError: 'Щось пішло не так. Спробуйте ще раз.',
  },
  login: {
    title: 'Вхід до облікового запису',
    description: 'Введіть свою пошту, щоб продовжити',
    submit: 'Увійти',
    submitting: 'Вхід...',
    noAccount: 'Ще не маєте облікового запису?',
    signUpLink: 'Зареєструватися',
  },
  signup: {
    title: 'Реєстрація',
    description: 'Створіть обліковий запис викладача',
    submit: 'Створити обліковий запис',
    submitting: 'Створення...',
    hasAccount: 'Вже маєте обліковий запис?',
    logInLink: 'Увійти',
    checkEmail: 'Ми надіслали лист для підтвердження. Перевірте свою пошту.',
  },
  admin: {
    title: 'Панель адміністратора',
    description: 'Повний доступ до викладачів, учнів і бібліотеки.',
  },
  // Keyed by the API's error codes, so a failure is translated once here rather than
  // wherever it happens to surface.
  errors: {
    unauthorized: 'Сесія завершилася. Увійдіть ще раз.',
    forbidden: 'У вас немає прав на цю дію.',
    not_found: 'Не знайдено.',
    validation_failed: 'Перевірте введені дані.',
    conflict: 'Дані змінилися. Оновіть сторінку та спробуйте ще раз.',
    rule_violation: 'Зараз цю дію виконати не можна.',
    upstream_unavailable: 'Сервіс тимчасово недоступний.',
    internal: 'Щось пішло не так. Спробуйте ще раз.',
  },
  teachers: {
    title: 'Викладачі',
    description: 'Усі викладачі та стан їхніх підписок.',
    searchPlaceholder: "Пошук за ім'ям або поштою",
    filterAll: 'Усі статуси',
    empty: 'Поки що немає жодного викладача.',
    noResults: 'Нічого не знайдено за цим запитом.',
    clear: 'Скинути',
    pagination: {
      previous: 'Назад',
      next: 'Далі',
      of: 'з',
    },
    noSubscription: 'Немає підписки',
    noEndDate: 'Без терміну',
    expired: 'Термін вийшов',
    columns: {
      name: "Ім'я",
      email: 'Пошта',
      status: 'Статус',
      remaining: 'Залишилось',
      joined: 'Приєднався',
      actions: 'Дії',
    },
    statuses: {
      trialing: 'Пробний період',
      active: 'Активна',
      past_due: 'Прострочена',
      suspended: 'Призупинена',
      canceled: 'Скасована',
    },
    // Ukrainian needs three forms for a counted noun; Intl.PluralRules picks between them.
    days: {
      one: 'день',
      few: 'дні',
      many: 'днів',
    },
    actions: {
      menu: 'Дії',
      extend: 'Продовжити на місяць',
      suspend: 'Призупинити',
      reactivate: 'Відновити',
      working: 'Зачекайте...',
    },
    suspendConfirm: {
      title: 'Призупинити доступ?',
      description:
        'Викладач не зможе працювати, доки ви не відновите доступ. Залишок часу збережеться.',
      cancel: 'Скасувати',
      confirm: 'Призупинити',
    },
    toast: {
      extended: 'Підписку продовжено',
      suspended: 'Доступ призупинено',
      reactivated: 'Доступ відновлено',
    },
    detail: {
      open: 'Переглянути деталі',
      account: 'Обліковий запис',
      joined: 'Приєднався',
      subscription: 'Підписка',
      // Kept short on purpose: these sit opposite a date in a narrow panel, and a label
      // that wraps drags the whole row out of line.
      startedAt: 'Створена',
      trialEnds: 'Пробний до',
      periodEnds: 'Оплачено до',
      accessEnds: 'Доступ до',
      access: 'Доступ',
      accessYes: 'Активний',
      accessNo: 'Немає',
      history: 'Історія змін',
      noHistory: 'Поки що нічого не змінювалось.',
      system: 'Система',
      loadFailed: 'Не вдалося завантажити деталі.',
      months: 'міс.',
      reason: 'Причина',
      /** Follows the counted noun: "днів залишилось". */
      remainingSuffix: 'залишилось',
    },
    events: {
      trial_started: 'Розпочато пробний період',
      extended: 'Продовжено',
      suspended: 'Призупинено',
      reactivated: 'Відновлено',
      canceled: 'Скасовано',
    },
  },
  teacher: {
    title: 'Панель викладача',
    description: 'Ваші учні, уроки та завдання.',
  },
  student: {
    title: 'Мої завдання',
    description: 'Завдання, які призначив ваш викладач.',
  },
}
