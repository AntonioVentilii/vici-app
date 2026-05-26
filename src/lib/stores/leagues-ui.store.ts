import { writable } from 'svelte/store';

/**
 * Cross-component signal for "open the create-league modal."
 *
 * The Social appbar `+` button (in `SocialPage`, visible when the
 * Leagues tab is active) and the in-content "Create league" CTAs on
 * `LeaguesPage` both need to trigger the same `CreateLeagueModal`.
 * Rather than thread a callback through the props chain, both
 * surfaces interact with this tiny intent store.
 *
 * Flow:
 *  - Trigger: caller flips `leaguesCreateIntent` to `true`.
 *  - Consumer: `LeaguesPage` subscribes; when it sees `true`, opens
 *    its internal `createOpen` modal and resets the intent to `false`.
 *
 * Keeping the intent boolean (vs an event-bus) means a navigation
 * away/back won't trigger a stale "open" event — the store is read
 * synchronously and reset on consumption.
 */
export const leaguesCreateIntent = writable<boolean>(false);
