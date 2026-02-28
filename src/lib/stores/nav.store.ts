import { writable } from 'svelte/store';

export type Page = 'markets' | 'portfolio' | 'leaderboard' | 'wallet' | 'admin';

export const navStore = writable<Page>('markets');

export const navigateTo = (page: Page) => {
	navStore.set(page);
};
