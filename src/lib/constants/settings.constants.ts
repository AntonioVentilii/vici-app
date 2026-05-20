import type { FlowSessionLength } from '$lib/types/preferences';

export const PREFERENCES_STORAGE_KEY = 'vici.preferences.v1';

export const FLOW_SESSION_LENGTH_OPTIONS: readonly {
	value: FlowSessionLength;
	label: string;
}[] = [
	{ value: 5, label: '5' },
	{ value: 10, label: '10' },
	{ value: 20, label: '20' }
] as const;
