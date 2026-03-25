/**
 * Promise coalescing / single-flight deduplication.
 * If multiple callers request the same key concurrently, only one fetch runs
 * and all callers receive the same result.
 */
const inFlight = new Map<string, Promise<unknown>>();

export async function withCoalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const existing = inFlight.get(key);
	if (existing) return existing as Promise<T>;

	const promise = fn().finally(() => {
		inFlight.delete(key);
	});

	inFlight.set(key, promise);
	return promise;
}
