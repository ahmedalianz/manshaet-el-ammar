export function signInDestination(
  next: unknown,
  admin = false,
  providerId?: unknown,
) {
  if (
    next === 'report' &&
    typeof providerId === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(providerId)
  )
    return {
      pathname: '/provider/report/[id]',
      params: { id: providerId },
    } as const;
  if (next === 'support') return '/support' as const;
  if (next === 'deletion') return '/info/deletion' as const;
  if (admin) return '/admin' as const;
  switch (next) {
    case 'add':
      return '/provider/add' as const;
    case 'more':
      return '/(tabs)/more' as const;
    case 'my-services':
      return '/(tabs)/my-services' as const;
    default:
      return '/(tabs)/my-services' as const;
  }
}
