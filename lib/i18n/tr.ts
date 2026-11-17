// Turkish. Same keys as en.ts.
import type { Messages } from "./en";

const tr: Messages = {
  common: {
    loading: "Yükleniyor…",
    saving: "Kaydediliyor…",
    save: "Kaydet",
    saveChanges: "Değişiklikleri kaydet",
    cancel: "İptal",
    delete: "Sil",
    edit: "Düzenle",
    add: "Ekle",
    close: "Kapat",
    back: "Geri",
    yes: "Evet",
    no: "Hayır",
    name: "Ad",
    password: "Şifre",
    optional: "isteğe bağlı",
    saved: "Kaydedildi.",
    somethingWrong: "Bir şeyler ters gitti. Lütfen tekrar deneyin.",
    comingSoon: "Yakında",
    showPassword: "Şifreyi göster",
    hidePassword: "Şifreyi gizle",
  },

  // Month names for dates (built by lib/format.ts, so server and browser agree).
  months: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],

  app: {
    name: "Dukaloo",
    tagline: "Mağazalar için satış noktası",
  },

  nav: {
    main: "Ana gezinme",
    dashboard: "Panel",
    staff: "Personel",
    settings: "Ayarlar",
    more: "Daha fazla",
    signOut: "Çıkış yap",
    skipToContent: "İçeriğe geç",
  },

  header: {
    openMenu: "Menüyü aç",
    userMenu: "Hesap menüsü",
    theme: "Tema",
    light: "Açık",
    dark: "Koyu",
    system: "Cihaza göre",
    language: "Dil",
    owner: "Sahip",
    online: "Çevrimiçi",
    offline: "Çevrimdışı",
  },

  updates: {
    title: "Yenilikler",
    none: "Şu anda yeni bir şey yok.",
    markRead: "Tümünü okundu say",
    // One entry per update in lib/updates.ts: { title, text }.
    items: {},
  },

  auth: {
    signInTitle: "Giriş yap",
    signInTo: (shop: string) => `${shop} için giriş`,
    who: "Kim giriş yapıyor?",
    owner: "Sahip",
    password: "Şifre",
    signIn: "Giriş yap",
    signingIn: "Giriş yapılıyor…",
    invalid: "Şifre doğru değil.",
    noOwnerYet: "Sahip şifresi henüz belirlenmedi. Belirlemek için Dukaloo'yu Ariloo hesabınızdan açın.",
    signedOut: "Çıkış yaptınız.",
  },

  ownerPassword: {
    title: "Sahip şifresi",
    chooseTitle: "Sahip şifrenizi seçin",
    chooseIntro:
      "Bu mağazaya her cihazdan giriş yapmak ve personelin giriş yaptığı bir kasada sahip ekranlarını açmak için kullanacaksınız. Kimseyle paylaşmayın.",
    changeIntro: "Değiştirmek, sahibin diğer tüm cihazlardaki oturumunu kapatır.",
    current: "Mevcut şifre",
    new: "Yeni şifre",
    confirm: "Yeni şifreyi tekrarlayın",
    mismatch: "İki şifre aynı değil.",
    tooShort: (n: number) => `En az ${n} karakter kullanın.`,
    done: "Sahip şifresi kaydedildi.",
    continue: "Panele devam et",
  },

  unlock: {
    title: "Sahip şifresi gerekli",
    text: "Bu cihazda sahip ekranlarını iki saatliğine açmak için sahip şifresini girin.",
    button: "Kilidi aç",
    lock: "Sahip ekranlarını kilitle",
    locked: "Sahip ekranları kilitlendi.",
    unlocked: "Sahip ekranları iki saatliğine açıldı.",
  },

  dashboard: {
    title: "Panel",
    hello: (name: string) => `Merhaba, ${name}`,
    helloOwner: "Merhaba",
    intro: "Mağazanıza kısa bir bakış.",
    subscription: "Abonelik",
    trialEnds: (date: string) => `Ücretsiz deneme ${date} tarihine kadar`,
    paidUntil: (date: string) => `${date} tarihine kadar ödendi`,
    graceUntil: (date: string) => `Ödeme gecikti. Mağaza ${date} tarihinde kapanacak.`,
    manage: "Ariloo'da yönet",
    shortcuts: "Kısayollar",
    gettingStarted: "Başlarken",
    stepStaff: "Kasayı kullanan her kişi için bir personel girişi ekleyin.",
    stepSettings: "Dilinizi ve temanızı seçin.",
    stepSoon: "Ürünler, kasa ve stok sonraki güncellemelerde geliyor.",
  },

  staff: {
    title: "Personel",
    intro: "Her kişinin kendi girişi olur. Hangi bölümleri açabileceklerini seçin.",
    add: "Personel ekle",
    editTitle: (name: string) => `${name} düzenle`,
    newTitle: "Yeni personel girişi",
    name: "Ad",
    password: "Şifre",
    newPassword: "Yeni şifre",
    keepPassword: "Mevcut şifreyi korumak için boş bırakın.",
    sections: "Açabileceği bölümler",
    active: "Giriş yapabilir",
    inactive: "Kapalı",
    none: "Henüz personel girişi yok.",
    deleteTitle: (name: string) => `${name} silinsin mi?`,
    deleteText: "Artık giriş yapamayacak. Yaptığı satışlar kayıtlarda kalır.",
    nameTaken: "Bu adda biri zaten var.",
    ownerOnly: "Personel girişlerini mağaza sahibi yönetir.",
    since: (date: string) => `${date} tarihinden beri`,
  },

  settings: {
    title: "Ayarlar",
    appearance: "Görünüm",
    theme: "Tema",
    language: "Dil",
    languageNote: "Bu cihazda kaydedilir. Mağazanın varsayılan dili Ariloo'da belirlenir.",
    shop: "Mağaza",
    shopNote: "Bunlar Ariloo hesabınızdan gelir.",
    shopName: "Ad",
    branch: "Şube",
    currency: "Para birimi",
    plan: "Plan",
    status: "Durum",
    manage: "Ariloo'da yönet",
    security: "Güvenlik",
    ownerPassword: "Sahip şifresi",
    changeOwnerPassword: "Sahip şifresini değiştir",
    lockDevice: "Bu cihazda sahip ekranlarını kilitle",
  },

  plans: {
    starter: "Başlangıç",
    pro: "Pro",
    advanced: "Gelişmiş",
    none: "Plan yok",
  },

  states: {
    waiting: "Henüz açılmadı",
    trial: "Ücretsiz deneme",
    active: "Etkin",
    grace: "Ödeme gecikti",
    expired: "Süresi doldu",
    suspended: "Askıya alındı",
  },

  notice: {
    notFoundTitle: "Mağaza bulunamadı",
    notFoundText: "Bu adreste bir Dukaloo mağazası yok. Bağlantıyı kontrol edin veya mağazanızı Ariloo hesabınızdan açın.",
    waitingTitle: "Henüz açılmadı",
    waitingText: "Bu mağaza henüz açılmadı. Kurulumu Ariloo hesabınızda tamamlayın.",
    closedTitle: "Bu mağaza kapalı",
    closedText: "Aboneliği sona erdi veya duraklatıldı. Sahibi, Ariloo hesabından yeniden açabilir.",
    noDatabaseText: "Bu mağazanın verileri hâlâ hazırlanıyor. Lütfen bir dakika sonra tekrar deneyin.",
    account: "Ariloo hesabınıza gidin",
  },

  errors: {
    notLoggedIn: "Lütfen tekrar giriş yapın.",
    noAccess: "Buna erişiminiz yok.",
    ownerOnly: "Bunu yalnızca mağaza sahibi yapabilir.",
    invalid: "Lütfen girdiklerinizi kontrol edin.",
    notFound: "Bulunamadı.",
    server: "Bizim tarafımızda bir sorun oluştu. Lütfen tekrar deneyin.",
    wrongPassword: "Şifre doğru değil.",
    tooMany: "Çok fazla deneme. Bir dakika bekleyip tekrar deneyin.",
  },
};

export default tr;
