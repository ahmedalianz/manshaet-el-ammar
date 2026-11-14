export const supportConfig = {
  email: 'ahmedalian400@gmail.com',
  privacyUrl: 'https://al-ammar-trust-guide.lovable.app/',
  deletionUrl: 'https://clearpath-account-removal.lovable.app/',
};
export function supportEmailUrl(
  email: string,
  deletion = false,
): string | null {
  if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) return null;
  const subject = deletion
    ? 'طلب حذف حساب وبيانات — منشأة العمار'
    : 'دعم تطبيق منشأة العمار';
  const body = deletion
    ? 'عايز أطلب حذف حسابي والبيانات المرتبطة بيه في تطبيق منشأة العمار. ببعتلكم من البريد المرتبط بحسابي. ممكن توضحوا خطوات التأكد من الحساب، والمدة، وإيه اللي هيتحذف أو هيتحفظ؟ الرسالة مفيهاش كلمة مرور أو أوراق شخصية.'
    : '';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
export async function openSupportLink(
  kind: 'privacy' | 'deletion-page' | 'email' | 'deletion',
  linking: { openURL: (url: string) => Promise<unknown> },
  config: {
    email: string;
    privacyUrl: string;
    deletionUrl?: string;
  } = supportConfig,
): Promise<boolean> {
  const pageUrl = kind === 'privacy' ? config.privacyUrl : config.deletionUrl;
  const url =
    kind === 'privacy' || kind === 'deletion-page'
      ? pageUrl && /^https:\/\/[^\s]+$/.test(pageUrl)
        ? pageUrl
        : null
      : supportEmailUrl(config.email, kind === 'deletion');
  if (!url) return false;
  try {
    await linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
