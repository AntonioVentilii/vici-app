<script lang="ts">
	import XpToast from '$lib/components/market/XpToast.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { XpPop } from '$lib/types/flow';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * FlowXpPops — multi-pop manager. Each entry in `pops` renders
	 * either an inline laurel/yes/no pop (the rich Svelte envelope with
	 * combo + bonus copy line — no prototype analogue) or, for the
	 * plain "+N VXP" ambient case, falls back to the standalone
	 * `<XpToast>` (the prototype's single pill in `flow.jsx:1569-1582`).
	 * The aggregator owns position + fan-out; `XpToast` owns the pill
	 * envelope when the simpler shape is enough.
	 */
	interface Props {
		pops: XpPop[];
	}

	const { pops }: Props = $props();

	// A pop routes to `<XpToast>` (the standalone prototype pill) when
	// it's a plain ambient award — no combo multiplier, no milestone
	// copy, no bonus envelope. Everything else takes the rich inline
	// envelope below so we keep combo + serif-italic milestone copy +
	// laurel ring on the cases that need them.
	const isPlainToast = (pop: XpPop): boolean =>
		pop.kind === 'normal' && pop.combo <= 1 && pop.copy === undefined;
</script>

<div class="xp-pops" aria-hidden="true">
	{#each pops as pop (pop.id)}
		{#if isPlainToast(pop)}
			<XpToast amount={pop.amount} side={pop.side} />
		{:else}
			<div
				class="xp-pop"
				class:xp-pop-bonus={pop.kind === 'bonus'}
				class:xp-pop-no={pop.kind === 'normal' && pop.side === 'NO'}
				class:xp-pop-yes={pop.kind === 'normal' && pop.side === 'YES'}
			>
				{#if pop.kind === 'bonus' && pop.copy}
					<span class="xp-pop-copy serif-italic">{pop.copy}</span>
				{/if}
				<span class="xp-pop-amount num">+{pop.amount}</span>
				<span class="xp-pop-label">
					{pop.combo > 1
						? t({
								locale: $localeStore,
								key: 'flow.xp_combo',
								params: { combo: pop.combo }
							})
						: t({ locale: $localeStore, key: 'flow.xp_label' })}
				</span>
			</div>
		{/if}
	{/each}
</div>

<style lang="postcss">
	.xp-pops {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 55;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.xp-pop {
		position: absolute;
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 10px 16px;
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 900;
		letter-spacing: -0.02em;
		background: var(--bg-popover);
		color: var(--laurel);
		box-shadow: var(--shadow-card);
		animation: xpPop 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}
	.xp-pop-label {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.7;
	}
	.xp-pop-yes {
		color: var(--yes);
		border: 2px solid var(--yes);
	}
	.xp-pop-no {
		color: var(--no);
		border: 2px solid var(--no);
	}
	/* Bonus pop — milestone reward (rarity ladder). Laurel ring, larger
	   amount, paired serif-italic copy on top, longer dwell. */
	.xp-pop-bonus {
		flex-direction: column;
		gap: 4px;
		padding: 14px 22px;
		font-size: 30px;
		color: var(--color-primary);
		border: 2px solid var(--color-primary);
		background: var(--bg-popover);
		box-shadow:
			0 0 32px var(--laurel-glow),
			var(--shadow-card);
		animation:
			xpPopBonus 1.8s var(--ease-vici) forwards,
			none;
	}
	.xp-pop-copy {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		font-weight: 400;
		color: var(--text-muted);
		letter-spacing: 0;
		text-transform: none;
		line-height: 1.1;
	}
	.xp-pop-amount {
		font-weight: 600;
	}
	@keyframes xpPopBonus {
		0% {
			transform: translateY(0) scale(0.7);
			opacity: 0;
		}
		15% {
			transform: translateY(-12px) scale(1.08);
			opacity: 1;
		}
		70% {
			transform: translateY(-90px) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateY(-150px) scale(0.95);
			opacity: 0;
		}
	}
	@keyframes xpPop {
		0% {
			transform: translateY(0) scale(0.6);
			opacity: 0;
		}
		20% {
			transform: translateY(-10px) scale(1.1);
			opacity: 1;
		}
		100% {
			transform: translateY(-120px) scale(0.9);
			opacity: 0;
		}
	}
</style>
