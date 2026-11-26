export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  switch (code) {
    case 'local/draft-cleanup':
      return 'المسودات لسه متحفظة على الجهاز، ومقدرناش نمسحها. جرّب تسجيل الخروج تاني.';
    case 'auth/invalid-email':
      return 'اكتب بريد إلكتروني صحيح.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور مش صح. راجعهم وجرّب تاني.';
    case 'auth/email-already-in-use':
      return 'البريد ده مسجل قبل كده. جرّب تسجيل الدخول أو إعادة تعيين كلمة المرور.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'اختار كلمة مرور أقوى، من ٦ أحرف على الأقل.';
    case 'auth/network-request-failed':
    case 'deadline-exceeded':
    case 'unavailable':
      return 'مفيش اتصال بالإنترنت أو الاتصال بطيء. اتأكد من الشبكة وحاول تاني.';
    case 'auth/too-many-requests':
      return 'محاولات كتير في وقت قصير. استنى شوية وحاول تاني.';
    case 'auth/user-disabled':
      return 'الحساب ده غير متاح حاليًا.';
    case 'auth/google-native-unavailable':
      return 'الدخول باستخدام Google محتاج نسخة تطوير من التطبيق، ومش متاح في Expo Go.';
    case 'auth/google-not-configured':
    case 'DEVELOPER_ERROR':
    case '10':
      return 'إعدادات Google للتطبيق محتاجة تكتمل. راجع معرّف العميل وبصمة توقيع النسخة.';
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return 'خدمات Google Play غير متاحة على الجهاز ده.';
    case 'auth/popup-blocked':
      return 'اسمح بفتح نافذة تسجيل الدخول وحاول تاني.';
    case 'auth/account-exists-with-different-credential':
      return 'البريد ده مسجل بطريقة دخول تانية. سجّل بنفس الطريقة اللي استخدمتها قبل كده.';
    case 'auth/operation-not-allowed':
      return 'طريقة تسجيل الدخول دي غير مفعّلة في المشروع حاليًا.';
    case 'permission-denied':
      return 'مش مسموح بتنفيذ العملية دي للحساب الحالي. جرّب تسجيل الدخول مرة تانية.';
    case 'auth/profile-sync-failed':
      return 'حسابك اتسجل، بس بياناته متحفظتش. سجّل دخولك بنفس البريد وكلمة المرور عشان نجرّب تاني، من غير ما تعمل حساب جديد.';
    case 'unauthenticated':
    case 'auth/requires-recent-login':
      return 'لحماية حسابك، سجّل الدخول من جديد قبل العملية دي.';
    case 'auth/user-mismatch':
      return 'الحساب اللي اخترته مش نفس حسابك الحالي. اختار نفس الحساب المسجل بيه وجرّب تاني.';
    case 'account/delete-unavailable':
      return 'حذف الحساب غير متاح حاليًا. جرّب تاني بعد شوية.';
    case 'account/admin-cannot-delete':
      return 'مينفعش تحذف حساب المشرف من التطبيق. اسحب صلاحية المشرف الأول.';
    case 'account/delete-incomplete':
      return 'مقدرناش نكمّل حذف كل البيانات في محاولة واحدة. جرّب تاني عشان تكمّل الحذف.';
    case 'auth/user-token-expired':
      return 'محتاج تسجّل دخولك تاني عشان تكمّل.';
    case 'already-exists':
    case 'failed-precondition':
      return 'في طلب للخدمة دي مستني المراجعة، أو البيانات اتغيّرت. حدّث الصفحة وجرّب تاني.';
    default:
      return 'حصلت مشكلة وإحنا بنكمّل. جرّب تاني.';
  }
}
export function firebaseMessage(error: unknown): string {
  if (
    error instanceof Error &&
    !('code' in error) &&
    /^[\u0600-\u06FF]/.test(error.message)
  )
    return error.message;
  return authErrorMessage(error);
}
