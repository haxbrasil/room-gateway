export async function waitFor<T>(
  getValue: () => T | Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 3_000,
  intervalMs = 20,
  timeoutMessage = 'Timed out waiting for condition',
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await getValue();

    if (predicate(value)) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(timeoutMessage);
}
