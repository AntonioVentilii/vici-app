import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'vici-theme';

const getInitialTheme = (): Theme => {
	if (!browser) {
		return 'dark';
	}

	return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
};

export const theme = writable<Theme>(getInitialTheme());

if (browser) {
	theme.subscribe((value) => {
		localStorage.setItem(THEME_KEY, value);
		document.documentElement.setAttribute('data-theme', value);
	});
}
