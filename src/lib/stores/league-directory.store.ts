import type { LeagueDoc } from '$lib/types/league';
import { writable } from 'svelte/store';

/**
 * Cache of `leagueId → LeagueDoc` for leagues the caller is **not** a
 * member of — the counterpart leagues referenced by a battle's sideA /
 * sideB. Mirrors [`profilesStore`](./profiles.store.ts): every surface
 * that names a league it doesn't own (battle headlines, the activity
 * feed, the battle detail face-off, the leagues-list activity preview)
 * resolves the current official name through this shared cache instead
 * of rendering the raw id.
 *
 * Populated incrementally by `loadLeaguesByIds` (see
 * `leagues.services.ts`): callers pass the league ids they're about to
 * render and the missing ones get fetched from the public `leagues`
 * collection and merged here. The caller's own memberships live in
 * `myLeaguesStore` — consumers check that first, then this cache, then
 * fall back to a shortened id.
 *
 * Leagues are public (name + accent + emblem) so this cache
 * intentionally survives auth transitions, exactly like the profile
 * cache.
 */
export const leagueDirectoryStore = writable<Map<string, LeagueDoc>>(new Map());
