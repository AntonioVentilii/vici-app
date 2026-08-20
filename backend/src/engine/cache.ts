// Tiny in-memory TTL cache for the anonymous public engine reads: the same
// market list / price history is asked for by every visitor, and a short TTL
// keeps the canister query volume flat without a cache dependency.

import { isNullish, nonNullish } from '@dfinity/utils';

interface Entry {
	value: unknown;
	expiresAt: number;
}

const store = new Map<string, Entry>();

/** Soft bound; the sweep on insert keeps an abandoned key set from growing
 * without limit. */
const MAX_ENTRIES = 500;

export const cached = async <T>({
	key,
	ttlMs,
	load
}: {
	key: string;
	ttlMs: number;
	load: () => Promise<T>;
}): Promise<T> => {
	const now = Date.now();
	const hit = store.get(key);

	if (nonNullish(hit) && hit.expiresAt > now) {
		return hit.value as T;
	}

	const value = await load();

	if (store.size >= MAX_ENTRIES) {
		for (const [entryKey, entry] of store) {
			if (entry.expiresAt <= now) {
				store.delete(entryKey);
			}
		}

		// Still over the bound after sweeping: drop oldest-inserted entries.
		while (store.size >= MAX_ENTRIES) {
			const oldest = store.keys().next().value;

			if (isNullish(oldest)) {
				break;
			}

			store.delete(oldest);
		}
	}

	store.set(key, { value, expiresAt: now + ttlMs });

	return value;
};

export const clearCache = (): void => {
	store.clear();
};
