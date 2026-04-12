import { balanceDomainStore } from '$lib/stores/balance-domain.store';
import type { LockedCapacityDisplayUnit } from '$lib/types/locked-capacity-display.types';
import {
	flowTradeDenominationLabel,
	lockedCapacityDenominationLabel,
	potentialReturnUnitSuffix
} from '$lib/utils/playground-display.utils';
import { derived, type Readable } from 'svelte/store';

/**
 * App "Playground" tab: on-chain `ViciXp`; clearing margin shown as VXP 1:1 (no USD framing).
 */
export const playgroundVxpUnitMode: Readable<boolean> = derived(
	balanceDomainStore,
	($s) => $s.value === 'playground'
);

export const playgroundFlowTradeUnitLabel: Readable<'VXP' | 'USD'> = derived(
	playgroundVxpUnitMode,
	(playground) => flowTradeDenominationLabel(playground)
);

export const playgroundLockedCapacityLabel: Readable<LockedCapacityDisplayUnit> = derived(
	playgroundVxpUnitMode,
	(playground) => lockedCapacityDenominationLabel(playground)
);

export const playgroundPotentialReturnSuffix: Readable<string> = derived(
	playgroundVxpUnitMode,
	(playground) => potentialReturnUnitSuffix(playground)
);
