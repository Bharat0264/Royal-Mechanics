// Resolve both successful and failed requests after the same 300 ms minimum.
// Longer network requests are never delayed further.
export async function requestWithMinimum(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const [result] = await Promise.allSettled([
    globalThis.fetch(input, init),
    new Promise<void>((resolve) => setTimeout(resolve, 300)),
  ]);
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}
