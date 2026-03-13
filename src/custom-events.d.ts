declare module 'svelte/elements' {
	/* eslint-disable */

	export interface HTMLAttributes<T> {
		onjunoSignOutAuthTimer?: (event: CustomEvent<any>) => void;
		onjunoExampleReload?: (event: CustomEvent<any>) => void;

		onviciRefreshBalances?: (event: CustomEvent<any>) => void;
		onviciRefreshCollaterals?: (event: CustomEvent<any>) => void;
		onviciRefreshMarkets?: (event: CustomEvent<any>) => void;
		onviciRefreshOrders?: (event: CustomEvent<any>) => void;
		onviciRefreshPositions?: (event: CustomEvent<any>) => void;
	}

	/* eslint-enable */
}

export {};
