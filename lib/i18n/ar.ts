// Arabic, right to left. Same keys as en.ts.
import type { Messages } from "./en";

const ar: Messages = {
  common: {
    loading: "جارٍ التحميل…",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    saveChanges: "حفظ التغييرات",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    add: "إضافة",
    close: "إغلاق",
    back: "رجوع",
    yes: "نعم",
    no: "لا",
    name: "الاسم",
    password: "كلمة المرور",
    optional: "اختياري",
    saved: "تم الحفظ.",
    somethingWrong: "حدث خطأ ما. يُرجى المحاولة مرة أخرى.",
    comingSoon: "قريبًا",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
  },

  // Month names for dates (built by lib/format.ts, so server and browser agree).
  months: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"],

  app: {
    name: "Dukaloo",
    tagline: "نظام نقاط البيع للمتاجر",
  },

  nav: {
    main: "التنقل الرئيسي",
    dashboard: "لوحة التحكم",
    staff: "الموظفون",
    settings: "الإعدادات",
    more: "المزيد",
    signOut: "تسجيل الخروج",
    skipToContent: "انتقل إلى المحتوى",
  },

  header: {
    openMenu: "فتح القائمة",
    userMenu: "قائمة الحساب",
    theme: "المظهر",
    light: "فاتح",
    dark: "داكن",
    system: "حسب الجهاز",
    language: "اللغة",
    owner: "المالك",
    online: "متصل",
    offline: "غير متصل",
  },

  updates: {
    title: "ما الجديد",
    none: "لا يوجد جديد حاليًا.",
    markRead: "تعليم الكل كمقروء",
    // One entry per update in lib/updates.ts: { title, text }.
    items: {},
  },

  auth: {
    signInTitle: "تسجيل الدخول",
    signInTo: (shop: string) => `تسجيل الدخول إلى ${shop}`,
    who: "من يسجّل الدخول؟",
    owner: "المالك",
    password: "كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    invalid: "كلمة المرور غير صحيحة.",
    noOwnerYet: "لم تُعيَّن كلمة مرور المالك بعد. افتح Dukaloo من حسابك في Ariloo لتعيينها.",
    signedOut: "تم تسجيل خروجك.",
  },

  ownerPassword: {
    title: "كلمة مرور المالك",
    chooseTitle: "اختر كلمة مرور المالك",
    chooseIntro:
      "ستستخدمها لتسجيل الدخول إلى هذا المتجر على أي جهاز، ولفتح شاشات المالك على جهاز يعمل عليه الموظفون. احتفظ بها لنفسك.",
    changeIntro: "تغييرها يسجّل خروج المالك من جميع الأجهزة الأخرى.",
    current: "كلمة المرور الحالية",
    new: "كلمة المرور الجديدة",
    confirm: "أعد كتابة كلمة المرور الجديدة",
    mismatch: "كلمتا المرور غير متطابقتين.",
    tooShort: (n: number) => `استخدم ${n} أحرف على الأقل.`,
    done: "تم حفظ كلمة مرور المالك.",
    continue: "المتابعة إلى لوحة التحكم",
  },

  unlock: {
    title: "كلمة مرور المالك مطلوبة",
    text: "أدخل كلمة مرور المالك لفتح شاشات المالك على هذا الجهاز لمدة ساعتين.",
    button: "فتح",
    lock: "قفل شاشات المالك",
    locked: "تم قفل شاشات المالك.",
    unlocked: "تم فتح شاشات المالك لمدة ساعتين.",
  },

  dashboard: {
    title: "لوحة التحكم",
    hello: (name: string) => `مرحبًا، ${name}`,
    helloOwner: "مرحبًا",
    intro: "نظرة سريعة على متجرك.",
    subscription: "الاشتراك",
    trialEnds: (date: string) => `تجربة مجانية حتى ${date}`,
    paidUntil: (date: string) => `مدفوع حتى ${date}`,
    graceUntil: (date: string) => `الدفع متأخر. سيُغلق المتجر في ${date}.`,
    manage: "الإدارة في Ariloo",
    shortcuts: "اختصارات",
    gettingStarted: "البدء",
    stepStaff: "أضف حساب موظف لكل شخص يستخدم نقطة البيع.",
    stepSettings: "اختر اللغة والمظهر.",
    stepSoon: "المنتجات ونقطة البيع والمخزون تصل في التحديثات القادمة.",
  },

  staff: {
    title: "الموظفون",
    intro: "لكل شخص حسابه الخاص. اختر الأقسام التي يمكنه فتحها.",
    add: "إضافة موظف",
    editTitle: (name: string) => `تعديل ${name}`,
    newTitle: "حساب موظف جديد",
    name: "الاسم",
    password: "كلمة المرور",
    newPassword: "كلمة مرور جديدة",
    keepPassword: "اتركها فارغة للإبقاء على كلمة المرور الحالية.",
    sections: "يمكنه فتح",
    active: "يمكنه تسجيل الدخول",
    inactive: "معطّل",
    none: "لا توجد حسابات موظفين بعد.",
    deleteTitle: (name: string) => `حذف ${name}؟`,
    deleteText: "لن يتمكن من تسجيل الدخول بعد الآن. تبقى المبيعات التي أجراها في السجلات.",
    nameTaken: "يوجد شخص آخر بهذا الاسم.",
    ownerOnly: "يدير المالك حسابات الموظفين.",
    since: (date: string) => `منذ ${date}`,
  },

  settings: {
    title: "الإعدادات",
    appearance: "المظهر",
    theme: "السمة",
    language: "اللغة",
    languageNote: "تُحفظ على هذا الجهاز. تُحدَّد لغة المتجر الافتراضية في Ariloo.",
    shop: "المتجر",
    shopNote: "تأتي هذه من حسابك في Ariloo.",
    shopName: "الاسم",
    branch: "الفرع",
    currency: "العملة",
    plan: "الخطة",
    status: "الحالة",
    manage: "الإدارة في Ariloo",
    security: "الأمان",
    ownerPassword: "كلمة مرور المالك",
    changeOwnerPassword: "تغيير كلمة مرور المالك",
    lockDevice: "قفل شاشات المالك على هذا الجهاز",
  },

  plans: {
    starter: "المبتدئة",
    pro: "الاحترافية",
    advanced: "المتقدمة",
    none: "بدون خطة",
  },

  states: {
    waiting: "لم يُفتح بعد",
    trial: "تجربة مجانية",
    active: "نشط",
    grace: "الدفع متأخر",
    expired: "منتهي",
    suspended: "موقوف",
  },

  notice: {
    notFoundTitle: "المتجر غير موجود",
    notFoundText: "لا يوجد متجر Dukaloo على هذا العنوان. تحقق من الرابط، أو افتح متجرك من حسابك في Ariloo.",
    waitingTitle: "لم يُفتح بعد",
    waitingText: "هذا المتجر لم يُفتح بعد. أكمل إعداده في حسابك في Ariloo.",
    closedTitle: "هذا المتجر مغلق",
    closedText: "انتهى اشتراكه أو تم إيقافه. يمكن للمالك إعادة فتحه من حسابه في Ariloo.",
    noDatabaseText: "لا تزال بيانات هذا المتجر قيد التجهيز. يُرجى المحاولة بعد دقيقة.",
    account: "اذهب إلى حسابك في Ariloo",
  },

  errors: {
    notLoggedIn: "يُرجى تسجيل الدخول مرة أخرى.",
    noAccess: "ليست لديك صلاحية لهذا.",
    ownerOnly: "هذا متاح للمالك فقط.",
    invalid: "يُرجى التحقق مما أدخلته.",
    notFound: "غير موجود.",
    server: "حدث خطأ من جهتنا. يُرجى المحاولة مرة أخرى.",
    wrongPassword: "كلمة المرور غير صحيحة.",
    tooMany: "محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.",
  },
};

export default ar;
