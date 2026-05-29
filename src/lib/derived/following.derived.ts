import { cachedListOrEmpty } from '$lib/derived/cached.derived';
import { followingStore } from '$lib/stores/following.store';
import type { PrincipalText } from '@junobuild/schema';
import type { Readable } from 'svelte/store';

export const following: Readable<PrincipalText[]> = cachedListOrEmpty(followingStore);
