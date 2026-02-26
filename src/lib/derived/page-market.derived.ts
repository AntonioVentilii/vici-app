import { routeMarketId } from '$lib/derived/nav.derived';
import type { MarketId } from '$lib/types/market';
import { parseMarketId } from '$lib/validation/market.validation';
import { nonNullish } from '@dfinity/utils';
import { derived, type Readable } from 'svelte/store';

export const pageMarketId: Readable<MarketId | undefined> = derived(
	[routeMarketId],
	([$routeMarketId]) => (nonNullish($routeMarketId) ? parseMarketId($routeMarketId) : undefined)
);
