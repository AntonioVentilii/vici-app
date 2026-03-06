import { page } from '$app/stores';
import { derived, type Readable } from 'svelte/store';

export const routeMarketId: Readable<string | undefined> = derived(
	[page],
	([
		{
			params: { id }
		}
	]) => id
);

export const routeSide: Readable<string | undefined> = derived(
	[page],
	([
		{
			url: { searchParams }
		}
	]) => searchParams.get('side') ?? undefined
);
