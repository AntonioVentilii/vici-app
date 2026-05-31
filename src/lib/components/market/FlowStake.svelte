<script lang="ts">
	import FlowStakeSlider from '$lib/components/market/FlowStakeSlider.svelte';
	import {
		VXP_DEFAULT_STAKE,
		VXP_STAKE_LADDER,
		type VxpStake
	} from '$lib/constants/vxp-economy.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import type { Market } from '$lib/types/market';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
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
	}

	const { market, yesPct, noPct, tradeAmount, onStakeChange }: Props = $props();

	// The stake ladder is shown whenever the stake controls are wired and
	// the user is on the ViciXP domain (the playground domain uses the
	// FlowMode stepper with fractional ICP / ckUSDC stakes, not the
	// ladder).
	const showStakeSlider = $derived(
		tradeAmount !== undefined && onStakeChange !== undefined && isViciXp($balanceDomain)
	);
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
{/if}
