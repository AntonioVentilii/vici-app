import { writable } from 'svelte/store';

export interface TradeStore {
	selectedPrice: number | undefined;
}

export const tradeStore = writable<TradeStore>({
	selectedPrice: undefined
});

export const selectPrice = (price: number) => {
	tradeStore.update((s) => ({ ...s, selectedPrice: price }));
};
