import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'dark' | 'light' | 'peach';

const THEME_KEY = 'vici-theme';
const THEMES: readonly Theme[] = ['dark', 'light', 'peach'] as const;

const getInitialTheme = (): Theme => {
	if (!browser) {
		return 'dark';
	}

	const value = localStorage.getItem(THEME_KEY);

	return THEMES.includes(value as Theme) ? (value as Theme) : 'dark';
};

export const theme = writable<Theme>(getInitialTheme());

if (browser) {
	theme.subscribe((value) => {
		localStorage.setItem(THEME_KEY, value);
		document.documentElement.setAttribute('data-theme', value);
	});
}
