import { goto } from '$app/navigation';
import { previousPathStore } from '$lib/stores/previous-path.store';
import { nonNullish } from '@dfinity/utils';
import { get } from 'svelte/store';

/**
 * Navigate "back" in a way that respects the user's actual entry point.
 *
 * - If a prior in-app navigation occurred, calls `history.back()` so the
 *   user returns to the page they came from (preserving scroll state).
 * - Otherwise (cold load, deep link, new tab) falls back to `goto(fallback)`.
 *
 * Relies on the root layout populating `previousPathStore` via `afterNavigate`.
 */
export const goBack = (fallback: string): void => {
	if (nonNullish(get(previousPathStore))) {
		history.back();

		return;
	}

	void goto(fallback);
};
