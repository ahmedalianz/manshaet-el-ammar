export const supportConfig = {
  email: 'ahmedalian400@gmail.com',
  privacyUrl: 'https://al-ammar-trust-guide.lovable.app/',
};
export function supportEmailUrl(email: string): string | null {
  if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) return null;
  const subject = 'دعم تطبيق منشأة العمار';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=`;
}
export async function openSupportLink(
  kind: 'privacy' | 'email',
  linking: { openURL: (url: string) => Promise<unknown> },
  config: {
    email: string;
    privacyUrl: string;
  } = supportConfig,
): Promise<boolean> {
  const url =
    kind === 'privacy'
      ? config.privacyUrl && /^https:\/\/[^\s]+$/.test(config.privacyUrl)
        ? config.privacyUrl
        : null
      : supportEmailUrl(config.email);
  if (!url) return false;
  try {
    await linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
