import { featuredEventActive } from '$lib/derived/featured-event.derived';
import { preferencesStore } from '$lib/stores/preferences.store';
import { derived, type Readable } from 'svelte/store';

/**
 * World-Cup mode foundation.
 *
 * Two orthogonal signals back the World-Cup experience:
 *
 * 1. {@link worldCupMode} — the *user's* persisted opt-in. Mirrors the
 *    `worldCupMode` flag on `profile.preferences` (cross-device, written
 *    through `preferencesStore`). It is a pure preference: `true` even
 *    after the event has archived if the user last left it on.
 * 2. {@link featuredEventActive} — the *product's* archive gate. Flips
 *    to `false` once `now` passes the featured event's `archiveAfter_ms`
 *    (the product-set cut-over date; see
 *    `featured-event.constants.ts`). Time-driven, user-independent.
 *
 * Consumers that want "should we render World-Cup content right now"
 * (later: Markets focus, the Dashboard WC tile) read {@link worldCupActive}
 * — the AND of the two — so they never re-derive the gate or reach into
 * the preferences object themselves.
 *
 * Deferred hook: the richer World-Cup → bridge → open retention *arc*
 * (gradually widening the deck from WC-only back to all categories as
 * the event winds down) is intentionally out of scope here. When it
 * lands it should layer on top of these signals — read `worldCupActive`
 * and the featured-event status rather than introducing a parallel
 * source of truth.
 */

/**
 * The user's persisted World-Cup-mode opt-in, projected off
 * `preferencesStore` so consumers can subscribe to just this flag
 * without destructuring the whole preferences object.
 */
export const worldCupMode: Readable<boolean> = derived(
	preferencesStore,
	(prefs) => prefs.worldCupMode
);

/**
 * Re-export of the product's archive gate for World-Cup content. `true`
 * while the featured event is `upcoming` / `live` / `wrap-up`; `false`
 * once it has archived. Surfaced here so World-Cup consumers have a
 * single import for the whole foundation.
 */
export const worldCupNotArchived: Readable<boolean> = featuredEventActive;

/**
 * Whether World-Cup content should be surfaced right now: the user has
 * opted in **and** the event has not yet archived. This is the boolean
 * most surfaces want.
 */
export const worldCupActive: Readable<boolean> = derived(
	[worldCupMode, worldCupNotArchived],
	([optedIn, notArchived]) => optedIn && notArchived
);
