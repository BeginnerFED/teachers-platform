import type { Messages } from './index'

// Hard stop: if this module is ever reached in a production build, fail loudly rather
// than quietly serving Turkish to Ukrainian teachers. The bundler should have dropped
// it long before this line can run — see getMessages() in ./server.
if (process.env.NODE_ENV === 'production') {
  throw new Error('The Turkish reading aid must never be loaded in production.')
}

/**
 * A reading aid for development only, so the person building this can see what each
 * screen actually says. Not a supported product language and never shipped.
 */
export const tr: Messages = {
  app: {
    name: 'Teachers Platform',
    description: 'İngilizce öğretmenleri için platform.',
  },
  common: {
    signOut: 'Çıkış',
    loading: 'Yükleniyor...',
  },
  auth: {
    emailLabel: 'E-posta',
    passwordLabel: 'Şifre',
    fullNameLabel: 'Ad ve soyad',
    invalidInput: 'Girdiğin bilgileri kontrol et. Şifre en az 8 karakter olmalı.',
    invalidCredentials: 'E-posta veya şifre hatalı.',
    genericError: 'Bir şeyler ters gitti. Tekrar dene.',
  },
  login: {
    title: 'Giriş',
    description: 'Hesabına giriş yap',
    submit: 'Giriş yap',
    submitting: 'Giriş yapılıyor...',
    noAccount: 'Henüz hesabın yok mu?',
    signUpLink: 'Kayıt ol',
  },
  signup: {
    title: 'Kayıt',
    description: 'Öğretmen hesabı oluştur',
    submit: 'Hesap oluştur',
    submitting: 'Oluşturuluyor...',
    hasAccount: 'Zaten hesabın var mı?',
    logInLink: 'Giriş yap',
    checkEmail: 'Onay e-postası gönderdik. Posta kutunu kontrol et.',
  },
  admin: {
    title: 'Yönetici paneli',
    description: 'Öğretmenlere, öğrencilere ve kütüphaneye tam erişim.',
  },
  teacher: {
    title: 'Öğretmen paneli',
    description: 'Öğrencilerin, derslerin ve ödevlerin.',
  },
  student: {
    title: 'Ödevlerim',
    description: 'Öğretmeninin sana verdiği ödevler.',
  },
}
