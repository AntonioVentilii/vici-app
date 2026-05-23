import type { UserProfile } from '$lib/types/profile';
import type { PrincipalText } from '@junobuild/schema';
import { writable } from 'svelte/store';

/**
 * Cache of `principal → UserProfile` shared across every surface that needs
 * to render a counterpart's name/avatar without re-hitting the satellite:
 * friends list, inbox, activity feed, market recent trades, market
 * discussion. Populated incrementally by `loadProfilesByPrincipals` (see
 * `profile.services.ts`) — callers pass the principals they're about to
 * render and the missing ones get fetched and merged here.
 *
 * Profiles are public (nickname + avatar etc.) so this cache intentionally
 * survives auth transitions: a fresh sign-in doesn't need to re-fetch the
 * profiles user A just looked at.
 */
export const profilesStore = writable<Map<PrincipalText, UserProfile>>(new Map());
