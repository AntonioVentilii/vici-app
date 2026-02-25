import { get, writable } from 'svelte/store';
import type { MarketSnapshot } from '../backend';
import { backend } from './actor';

function createMarketsStore() {
	const { subscribe, set, update } = writable<{
		markets: MarketSnapshot[];
		isLoading: boolean;
		isFetched: boolean;
	}>({
		markets: [],
		isLoading: false,
		isFetched: false
	});

	async function fetchMarkets() {
		const { actor } = get(backend);
		if (!actor) return;

		update((s) => ({ ...s, isLoading: true }));
		try {
			const markets = await actor.getAllMarkets();
			set({
				markets: markets || [],
				isLoading: false,
				isFetched: true
			});
		} catch (error) {
			console.error('Failed to fetch markets:', error);
			update((s) => ({ ...s, isLoading: false, isFetched: true }));
		}
	}

	// Refresh when backend actor changes
	backend.subscribe(({ actor }) => {
		if (actor) {
			fetchMarkets();
		} else {
			set({ markets: [], isLoading: false, isFetched: false });
		}
	});

	return {
		subscribe,
		refresh: fetchMarkets
	};
}

export const markets = createMarketsStore();
