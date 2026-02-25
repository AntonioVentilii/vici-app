import type { Principal } from '@icp-sdk/core/principal';
import { get, writable } from 'svelte/store';
import { backend } from './actor';

function createLeaderboardStore() {
	const { subscribe, set, update } = writable<{
		leaderboard: [Principal, bigint][];
		isLoading: boolean;
		isFetched: boolean;
	}>({
		leaderboard: [],
		isLoading: false,
		isFetched: false
	});

	async function fetchLeaderboard(topN: number = 50) {
		const { actor } = get(backend);
		if (!actor) return;

		update((s) => ({ ...s, isLoading: true }));
		try {
			let data: [Principal, bigint][] = [];
			if (
				'getTopUsersByBalance' in actor &&
				typeof (actor as any).getTopUsersByBalance === 'function'
			) {
				data = await (actor as any).getTopUsersByBalance(BigInt(topN));
			} else if ('getLeaderboard' in actor && typeof (actor as any).getLeaderboard === 'function') {
				data = await (actor as any).getLeaderboard(BigInt(topN));
			}

			set({
				leaderboard: data || [],
				isLoading: false,
				isFetched: true
			});
		} catch (error) {
			console.error('Failed to fetch leaderboard:', error);
			update((s) => ({ ...s, isLoading: false, isFetched: true }));
		}
	}

	// Refresh when backend actor changes
	backend.subscribe(({ actor }) => {
		if (actor) {
			fetchLeaderboard();
		} else {
			set({ leaderboard: [], isLoading: false, isFetched: false });
		}
	});

	return {
		subscribe,
		refresh: fetchLeaderboard
	};
}

export const leaderboard = createLeaderboardStore();
