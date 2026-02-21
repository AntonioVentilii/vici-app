declare module 'svelte/elements' {
	/* eslint-disable */

	export interface HTMLAttributes<T> {
		onjunoSignOutAuthTimer?: (event: CustomEvent<any>) => void;
		onjunoExampleReload?: (event: CustomEvent<any>) => void;
	}

	/* eslint-enable */
}

export {};
