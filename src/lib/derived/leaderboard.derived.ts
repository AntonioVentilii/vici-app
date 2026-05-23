import { cachedListOrEmpty, cachedNotInitialized } from '$lib/derived/cached.derived';
import { leaderboardStore } from '$lib/stores/leaderboard.store';
import type { UserProfile } from '$lib/types/profile';
import type { Readable } from 'svelte/store';

export const leaderboard: Readable<UserProfile[]> = cachedListOrEmpty(leaderboardStore);

export const leaderboardNotInitialized: Readable<boolean> = cachedNotInitialized(leaderboardStore);
