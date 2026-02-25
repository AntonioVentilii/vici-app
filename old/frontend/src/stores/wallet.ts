import { writable, get } from 'svelte/store';
import { backend } from './actor';
import type { WalletBalance } from '../backend';

function createWalletStore() {
	const { subscribe, set, update } = writable<{
		balance: WalletBalance | null;
		isLoading: boolean;
		isFetched: boolean;
	}>({
		balance: null,
		isLoading: false,
		isFetched: false
	});

	async function fetchBalance() {
		const { actor } = get(backend);
		if (!actor) return;

		update((s) => ({ ...s, isLoading: true }));
		try {
			const balance = await actor.getWalletBalance();
			set({
				balance,
				isLoading: false,
				isFetched: true
			});
		} catch (error) {
			console.error('Failed to fetch wallet balance:', error);
			update((s) => ({ ...s, isLoading: false, isFetched: true }));
		}
	}

	// Refresh when backend actor changes
	backend.subscribe(({ actor }) => {
		if (actor) {
			fetchBalance();
		} else {
			set({ balance: null, isLoading: false, isFetched: false });
		}
	});

	return {
		subscribe,
		refresh: fetchBalance
	};
}

export const wallet = createWalletStore();
