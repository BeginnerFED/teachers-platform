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
  teacher: {
    title: 'Панель викладача',
    description: 'Ваші учні, уроки та завдання.',
  },
  student: {
    title: 'Мої завдання',
    description: 'Завдання, які призначив ваш викладач.',
  },
}
