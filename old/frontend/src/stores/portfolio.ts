import { writable, get } from 'svelte/store';
import { backend } from './actor';
import type { Position, Transaction } from '../backend';

function createPortfolioStore() {
	const { subscribe, set, update } = writable<{
		positions: Position[];
		transactions: Transaction[];
		isLoading: boolean;
		isFetched: boolean;
	}>({
		positions: [],
		transactions: [],
		isLoading: false,
		isFetched: false
	});

	async function fetchData() {
		const { actor } = get(backend);
		if (!actor) return;

		update((s) => ({ ...s, isLoading: true }));
		try {
			const [positions, transactions] = await Promise.all([
				actor.getUserPositions(),
				actor.getUserTransactions()
			]);
			set({
				positions: positions || [],
				transactions: transactions || [],
				isLoading: false,
				isFetched: true
			});
		} catch (error) {
			console.error('Failed to fetch portfolio data:', error);
			update((s) => ({ ...s, isLoading: false, isFetched: true }));
		}
	}

	// Refresh when backend actor changes
	backend.subscribe(({ actor }) => {
		if (actor) {
			fetchData();
		} else {
			set({ positions: [], transactions: [], isLoading: false, isFetched: false });
		}
	});

	return {
		subscribe,
		refresh: fetchData
	};
}

export const portfolio = createPortfolioStore();
