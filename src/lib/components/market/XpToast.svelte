<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { CallSide } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * XpToast — single VXP-award pill that rises from the swipe-exit
	 * edge of the deck. Renders nothing for SKIP commits or zero-XP
	 * awards. The `bonus` flag adds the "milestone" annotation tag on
	 * milestone awards. Self-dismisses on a 900 ms timer aligned to
	 * the `xp-toast-pop` keyframe.
	 *
	 * `FlowXpPops` is the multi-pop manager; it composes a list of
	 * `XpToast`s with per-pop animation envelopes. This component is
	 * the single-toast unit a caller can drop into any one-shot context.
	 */
	interface Props {
		amount: number;
		bonus?: number;
		side: CallSide | 'SKIP';
		onDone?: () => void;
	}

	const { amount, bonus = 0, side, onDone }: Props = $props();

	let timer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		timer = setTimeout(() => {
			onDone?.();
		}, 900);
	});

	onDestroy(() => {
		if (timer !== null) {
			clearTimeout(timer);
		}
	});

	const visible = $derived(side !== 'SKIP' && amount > 0);

	const sideClass = $derived(side === 'YES' ? 'is-yes' : 'is-no');
</script>

{#if visible}
	<div class="xp-toast {sideClass}">
		<span class="num">+{amount}</span>
		<small>{t({ locale: $localeStore, key: 'flow.feedback.vxp' })}</small>
		{#if bonus > 0}
			<em>{t({ locale: $localeStore, key: 'flow.xp_toast.milestone' })}</em>
		{/if}
	</div>
{/if}
