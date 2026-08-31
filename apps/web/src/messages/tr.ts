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
    tagline: 'Ders hazırlığına daha az, öğretmeye daha çok zaman.',
  },
  common: {
    signOut: 'Çıkış',
    loading: 'Yükleniyor...',
    soon: 'Yakında',
    retry: 'Tekrar dene',
  },
  nav: {
    workspace: 'Çalışma alanı',
    search: 'Ara',
    home: 'Ana sayfa',
    settings: 'Ayarlar',
    help: 'Yardım',
    empty: 'Henüz boş',
    overview: 'Genel bakış',
    library: 'Kütüphane',
    teachers: 'Öğretmenler',
    students: 'Öğrenciler',
    myStudents: 'Öğrencilerim',
    assignments: 'Ödevler',
    progress: 'İlerleme',
  },
  roles: {
    admin: 'Yönetici',
    teacher: 'Öğretmen',
    student: 'Öğrenci',
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
    title: 'Hesabına giriş yap',
    description: 'Devam etmek için e-postanı gir',
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
  errors: {
    unauthorized: 'Oturum sona erdi. Tekrar giriş yap.',
    forbidden: 'Bu işlem için yetkin yok.',
    not_found: 'Bulunamadı.',
    validation_failed: 'Girdiğin bilgileri kontrol et.',
    conflict: 'Veriler değişmiş. Sayfayı yenileyip tekrar dene.',
    rule_violation: 'Bu işlem şu an yapılamaz.',
    upstream_unavailable: 'Servis geçici olarak kullanılamıyor.',
    internal: 'Bir şeyler ters gitti. Tekrar dene.',
  },
  teachers: {
    title: 'Öğretmenler',
    description: 'Tüm öğretmenler ve abonelik durumları.',
    searchPlaceholder: 'İsim veya e-posta ile ara',
    filterAll: 'Tüm durumlar',
    empty: 'Henüz hiç öğretmen yok.',
    noSubscription: 'Abonelik yok',
    noEndDate: 'Süresiz',
    expired: 'Süresi doldu',
    total: 'Toplam',
    columns: {
      name: 'İsim',
      email: 'E-posta',
      status: 'Durum',
      remaining: 'Kalan',
      joined: 'Katıldı',
      actions: 'İşlemler',
    },
    statuses: {
      trialing: 'Deneme',
      active: 'Aktif',
      past_due: 'Süresi geçti',
      suspended: 'Askıda',
      canceled: 'İptal',
    },
    // Turkish does not inflect a counted noun, so all three forms are the same word.
    days: {
      one: 'gün',
      few: 'gün',
      many: 'gün',
    },
    actions: {
      menu: 'İşlemler',
      extend: 'Bir ay uzat',
      suspend: 'Askıya al',
      reactivate: 'Yeniden aç',
      working: 'Bekle...',
    },
    suspendConfirm: {
      title: 'Erişim askıya alınsın mı?',
      description:
        'Öğretmen sen yeniden açana kadar çalışamayacak. Kalan süresi korunur.',
      cancel: 'Vazgeç',
      confirm: 'Askıya al',
    },
    toast: {
      extended: 'Abonelik uzatıldı',
      suspended: 'Erişim askıya alındı',
      reactivated: 'Erişim yeniden açıldı',
    },
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
