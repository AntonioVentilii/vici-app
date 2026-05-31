<script lang="ts">
	import FlowStakeSlider from '$lib/components/market/FlowStakeSlider.svelte';
	import {
		isStakeLadderUnlocked,
		STAKE_LADDER_UNLOCK_CALLS,
		VXP_DEFAULT_STAKE,
		VXP_STAKE_LADDER,
		type VxpStake
	} from '$lib/constants/vxp-economy.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { snapToStakeLadder, vxpNetWin } from '$lib/utils/vxp-economy.utils';

	interface Props {
		market: Market;
		yesPct: number;
		noPct: number;
		// Current stake amount (string for input-binding parity with
		// FlowMode). Drives the stake slider and payout preview.
		tradeAmount?: string;
		// Stake-ladder change callback. Fires when a rung or the
		// native range input changes.
		onStakeChange?: (next: string) => void;
		// Lifetime committed-call count. Gates the stake-ladder slider —
		// it stays hidden until the unlock threshold so new predictors
		// see one stake, no decision paralysis.
		lifetimeCalls?: number;
	}

	const { market, yesPct, noPct, tradeAmount, onStakeChange, lifetimeCalls = 0 }: Props = $props();

	// VXP stake control is only relevant on the ViciXP domain with the
	// stake callbacks wired (the playground domain uses the FlowMode
	// stepper, not the ladder).
	const stakeControlActive = $derived(
		tradeAmount !== undefined && onStakeChange !== undefined && isViciXp($balanceDomain)
	);
	// The ladder slider unlocks once the user has enough lifetime calls;
	// before that the stake stays pinned to the default and we show a
	// short "unlocks at N" line in its place.
	const stakeLadderUnlocked = $derived(isStakeLadderUnlocked(lifetimeCalls));
	const showStakeSlider = $derived(stakeControlActive && stakeLadderUnlocked);
	const showStakeLocked = $derived(stakeControlActive && !stakeLadderUnlocked);
	const stakeCallsLeft = $derived(Math.max(0, STAKE_LADDER_UNLOCK_CALLS - lifetimeCalls));
	const currentStake: VxpStake = $derived(
		showStakeSlider
			? snapToStakeLadder({ value: Number(tradeAmount ?? '0') || 0 })
			: VXP_DEFAULT_STAKE
	);
	const stakeIdx = $derived(VXP_STAKE_LADDER.indexOf(currentStake));
	const stakePct = $derived(stakeIdx >= 0 ? (stakeIdx / (VXP_STAKE_LADDER.length - 1)) * 100 : 0);
	const atCap = $derived(currentStake === VXP_STAKE_LADDER[VXP_STAKE_LADDER.length - 1]);
	const stakeYesWin = $derived(vxpNetWin({ stake: currentStake, pWin: market.yesProbability }));
	const stakeNoWin = $derived(vxpNetWin({ stake: currentStake, pWin: 1 - market.yesProbability }));

	const selectStake = (rung: VxpStake) => {
		if (onStakeChange === undefined) {
			return;
		}

		onStakeChange(String(rung));
	};

	const onStakeRangeChange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		const idx = parseInt(target.value, 10);
		const rung = VXP_STAKE_LADDER[idx];

		if (rung !== undefined) {
			selectStake(rung);
		}
	};
</script>

{#if showStakeSlider}
	<FlowStakeSlider
		{atCap}
		{currentStake}
		{noPct}
		onSelectStake={selectStake}
		{onStakeRangeChange}
		{stakeIdx}
		{stakeNoWin}
		{stakePct}
		{stakeYesWin}
		{yesPct}
	/>
{:else if showStakeLocked}
	<p class="flow-stake-locked">
		{t({
			locale: $localeStore,
			key: 'card.back.stake_locked',
			params: { left: stakeCallsLeft, threshold: STAKE_LADDER_UNLOCK_CALLS }
		})}
	</p>
{/if}

<style lang="postcss">
	.flow-stake-locked {
		margin: 0;
		padding: 0.5rem 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: 1.4;
		text-align: center;
		text-wrap: balance;
	}
</style>
