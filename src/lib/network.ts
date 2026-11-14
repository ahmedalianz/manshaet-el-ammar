// Only wrap reads: timing out a write does not establish whether it committed.
export async function readWithDeadline<T>(
  operation: Promise<T>,
  milliseconds = 15_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error('Server read timed out'), {
                code: 'deadline-exceeded',
              }),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export function shouldRetryRead(failureCount: number, error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  return (
    failureCount < 1 &&
    [
      'unavailable',
      'deadline-exceeded',
      'aborted',
      'auth/network-request-failed',
    ].includes(code)
  );
}
