import { browser } from '$app/environment';
import { nonNullish } from '@dfinity/utils';

/**
 * Best-effort JSON localStorage helpers. Failures are non-fatal because storage
 * only holds UI/operational preferences, never authoritative state.
 */

export const set = <T>({ key, value }: { key: string; value: T }) => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (err: unknown) {
		console.error(err);
	}
};

export const del = ({ key }: { key: string }) => {
	try {
		localStorage.removeItem(key);
	} catch (err: unknown) {
		console.error(err);
	}
};

export const get = <T>({ key }: { key: string }): T | undefined => {
	try {
		const value = browser ? localStorage.getItem(key) : null;

		return nonNullish(value) ? JSON.parse(value) : undefined;
	} catch (err: unknown) {
		console.error(err);
	}
};
