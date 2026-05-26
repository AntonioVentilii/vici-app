import { browser } from '$app/environment';
import { balanceDomain } from '$lib/derived/balance-domain.derived';
import { featuredEvent, featuredEventActive } from '$lib/derived/featured-event.derived';
import { userSignedIn } from '$lib/derived/user.derived';
import { prepareFlow, type PreparedFlow } from '$lib/services/flow-prep.services';
import { userStore } from '$lib/stores/user.store';
import { isNullish, nonNullish } from '@dfinity/utils';
import { derived, get, writable, type Readable } from 'svelte/store';

type FlowStoreStatus = 'idle' | 'building' | 'ready' | 'stale';

interface FlowStoreData {
	current: PreparedFlow | undefined;
	next: PreparedFlow | undefined;
	status: FlowStoreStatus;
}

const initial: FlowStoreData = {
	current: undefined,
	next: undefined,
	status: 'idle'
};

const internal = writable<FlowStoreData>(initial);

/**
 * Read-only handle for components: the prepared payload for the
 * active Flow session (`current`), the pre-built follow-up
 * (`next`), and a coarse status reflecting whether a build is in
 * flight.
 */
export const flowStore: Readable<FlowStoreData> = { subscribe: internal.subscribe };

/**
 * Monotonic token used to drop stale builds that resolve after a
 * newer invalidate. Bumped at the start of every build attempt —
 * any in-flight call older than the latest token is discarded on
 * resolve.
 */
let buildToken = 0;
let initialized = false;

const currentTag = (): string | undefined =>
	get(featuredEventActive) ? get(featuredEvent).categoryTag : undefined;

const runBuild = async (
	exclude: ReadonlyArray<string>
): Promise<{ result: PreparedFlow | undefined; token: number }> => {
	const token = ++buildToken;
	const domain = get(balanceDomain);
	const signedIn = get(userSignedIn);
	const featuredEventTag = currentTag();

	let result: PreparedFlow | undefined;

	try {
		result = await prepareFlow({
			domain,
			featuredEventTag,
			signedIn,
			exclude
		});
	} catch (e: unknown) {
		// Non-fatal — keep `result` undefined so callers leave the
		// store untouched and rely on the existing payload (or a
		// subsequent invalidate) instead of clobbering it.
		console.error('Flow prewarm failed', e);
	}

	return { result, token };
};

const warm = async (): Promise<void> => {
	const state = get(internal);

	if (state.status === 'building') {
		return;
	}

	internal.update((s) => ({ ...s, status: 'building' }));

	const { result: current, token } = await runBuild([]);

	if (token !== buildToken || isNullish(current)) {
		internal.update((s) => ({
			...s,
			status: nonNullish(s.current) ? 'ready' : 'idle'
		}));

		return;
	}

	internal.update((s) => ({ ...s, current, status: 'ready' }));

	const { result: next, token: nextToken } = await runBuild(current.markets.map((m) => m.id));

	if (nextToken === buildToken && nonNullish(next)) {
		internal.update((s) => ({ ...s, next }));
	}
};

/**
 * Mark the cache as stale and rebuild in the background. The
 * previous deck stays visible to consumers until the rebuild lands
 * so the UI never blocks on the refresh.
 */
export const invalidateFlow = (): void => {
	if (!browser) {
		return;
	}

	internal.update((s) => ({
		...s,
		status: nonNullish(s.current) ? 'stale' : 'idle'
	}));

	void warm();
};

/**
 * Promote `next` → `current` and rebuild a fresh follow-up. Called
 * by FlowMode after a session ends so the next entry into `/flow`
 * opens on an unseen deck without a network round-trip. Falls back
 * to a full warm cycle if no `next` was ready in time.
 */
export const advanceFlow = (): void => {
	if (!browser) {
		return;
	}

	let promoted: PreparedFlow | undefined;

	internal.update((s) => {
		if (isNullish(s.next)) {
			return { ...s, status: nonNullish(s.current) ? 'stale' : 'idle' };
		}

		promoted = s.next;

		return { current: s.next, next: undefined, status: 'ready' };
	});

	if (isNullish(promoted)) {
		void warm();

		return;
	}

	void (async () => {
		const exclude = promoted?.markets.map((m) => m.id) ?? [];
		const { result, token } = await runBuild(exclude);

		if (token === buildToken && nonNullish(result)) {
			internal.update((s) => ({ ...s, next: result }));
		}
	})();
};

/**
 * Returns the prepared current Flow without removing it from the
 * store. FlowMode reads this synchronously on mount; the payload
 * stays in `current` until `advanceFlow()` promotes `next` over
 * it. Returns `undefined` while the first warm is still in flight
 * — the component should fall back to an on-demand `prepareFlow()`
 * call in that race.
 */
export const peekFlow = (): PreparedFlow | undefined => get(internal).current;

/**
 * Subscribes to the inputs that affect the prepared deck and kicks
 * an initial warm. Call once from `(app)/+layout.svelte` on mount.
 *
 * Each subscription only invalidates when its tracked slice
 * actually changes — the initial fire (which mirrors current
 * state) is absorbed, and an explicit `invalidateFlow()` call at
 * the end of init does the first warm so we don't depend on a
 * spurious change to seed the cache.
 */
export const initFlowPrewarm = (): (() => void) => {
	if (!browser || initialized) {
		return () => undefined;
	}

	initialized = true;

	// Profile signature is restricted to slices that actually change
	// the ranking output (principal + interests). The full userStore
	// updates frequently (auth busy flag, daily streak persistence)
	// and would otherwise re-warm on every tick.
	const trackedProfileSig: Readable<string> = derived(userStore, ($u) => {
		const interests = ($u.profile?.interests ?? []).slice().sort().join(',');

		return `${$u.user?.key ?? ''}|${interests}`;
	});

	const onChange = <T>({
		store,
		toKey
	}: {
		store: Readable<T>;
		toKey: (v: T) => string;
	}): (() => void) => {
		let last: string | undefined;
		let first = true;

		return store.subscribe((v) => {
			const key = toKey(v);

			if (first) {
				last = key;
				first = false;

				return;
			}

			if (key !== last) {
				last = key;
				invalidateFlow();
			}
		});
	};

	const stops = [
		onChange({ store: userSignedIn, toKey: (v) => String(v) }),
		onChange({ store: balanceDomain, toKey: (v) => JSON.stringify(v) }),
		onChange({ store: featuredEventActive, toKey: (v) => String(v) }),
		onChange({ store: trackedProfileSig, toKey: (v) => v })
	];

	// Initial warm — fires after subscriptions are wired so any
	// input that mutates during the warm triggers a follow-up build.
	invalidateFlow();

	return () => {
		for (const stop of stops) {
			stop();
		}

		initialized = false;
	};
};
